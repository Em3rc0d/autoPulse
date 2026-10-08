import { CHECK_CORE_DESCRIPTOR_REGISTRY_V3 } from '../../planner/DiagnosticDescriptorRegistryV3';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import { decodePromotedMode01Observation } from '../../intelligence/Mode01ValueDecoder';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';
import { runDiagnosticScan } from '../DiagnosticScanEngine';

const fixture: DiagnosticReplayFixture = {
  fixtureId: 'check-v5-adaptive-can-synthetic',
  protocol: 'ISO_15765_CAN',
  provenance: 'SYNTHETIC_NOT_PHYSICAL_CERTIFICATION: adaptive standard-OBD authorization + parser regression',
  startedAt: 1000,
  scripts: [
    {
      semanticId: 'check.obd.mode01.observe.04',
      targetEndpointId: null,
      events: [{
        kind: 'COMMAND_RESPONSE',
        durationMs: 5,
        observedResponseBytes: 3,
        envelope: {
          kind: 'POSITIVE_RESPONSE',
          requestService: '01',
          responseService: '41',
          payload: [0x04, 0x80],
          protocol: 'ISO_15765_CAN',
          sourceEndpointId: null,
          provenance: 'synthetic 0104',
          observedAt: 1005,
          rawText: '410480',
        },
      }],
    },
    {
      semanticId: 'check.obd.mode01.observe.05',
      targetEndpointId: null,
      events: [{
        kind: 'COMMAND_RESPONSE',
        durationMs: 5,
        observedResponseBytes: 3,
        envelope: {
          kind: 'POSITIVE_RESPONSE',
          requestService: '01',
          responseService: '41',
          payload: [0x05, 0x68],
          protocol: 'ISO_15765_CAN',
          sourceEndpointId: null,
          provenance: 'synthetic 0105',
          observedAt: 1010,
          rawText: '410568',
        },
      }],
    },
    {
      semanticId: 'check.obd.mode01.observe.0C',
      targetEndpointId: null,
      events: [{
        kind: 'COMMAND_RESPONSE',
        durationMs: 5,
        observedResponseBytes: 4,
        envelope: {
          kind: 'POSITIVE_RESPONSE',
          requestService: '01',
          responseService: '41',
          payload: [0x0c, 0x0f, 0xa0],
          protocol: 'ISO_15765_CAN',
          sourceEndpointId: null,
          provenance: 'synthetic 010C',
          observedAt: 1015,
          rawText: '410C0FA0',
        },
      }],
    },
    {
      semanticId: 'check.obd.mode01.observe.42',
      targetEndpointId: null,
      events: [{
        kind: 'COMMAND_RESPONSE',
        durationMs: 5,
        observedResponseBytes: 4,
        envelope: {
          kind: 'POSITIVE_RESPONSE',
          requestService: '01',
          responseService: '41',
          payload: [0x42, 0x36, 0xb0],
          protocol: 'ISO_15765_CAN',
          sourceEndpointId: null,
          provenance: 'synthetic 0142',
          observedAt: 1020,
          rawText: '414236B0',
        },
      }],
    },
  ],
};

describe('CHECK v5 adaptive standard-OBD replay integration', () => {
  it('authorizes, executes and decodes a bounded CAN vehicle snapshot without free-form commands', async () => {
    const plan = buildDiagnosticScanPlan({
      planId: 'check-v5-adaptive-can',
      createdAt: fixture.startedAt,
      protocol: fixture.protocol,
      registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
      proposals: ['04', '05', '0C', '42'].map(pid => ({
        semanticId: `check.obd.mode01.observe.${pid}`,
        required: false,
        rationaleEvidenceIds: ['adaptive-fixture'],
      })),
      budget: {
        maxCommands: 4,
        maxResponseBytes: 512,
        maxBytesPerResponse: 64,
        maxElapsedMs: 5000,
        minInterCommandDelayMs: 0,
        provenance: 'adaptive replay fixture',
      },
      retryPolicy: {
        maxRetries: 0,
        retryableOutcomes: [],
        responsePending: { maxExtensions: 0, extensionMs: 100 },
        provenance: 'adaptive replay fixture',
      },
      deadlinePolicy: {
        overallDeadlineMs: 5000,
        stageDeadlineMs: {
          CAPABILITY_DISCOVERY: 5000,
          DTC_CORE: 5000,
          TARGETED_PID_ACQUISITION: 5000,
        },
        provenance: 'adaptive replay fixture',
      },
    });

    expect(plan.status).toBe('READY');
    expect(plan.requests.map(item => item.pid)).toEqual(['04', '05', '0C', '42']);

    const scan = await runDiagnosticScan({
      plan,
      executor: new DiagnosticReplayExecutor(fixture),
    });

    expect(scan.state).toBe('COMPLETE');
    expect(scan.usage.commandsIssued).toBe(4);
    expect(scan.mode01DirectResults).toHaveLength(4);

    const decoded = scan.mode01DirectResults
      .map(decodePromotedMode01Observation)
      .filter(Boolean);

    expect(decoded.map(item => item?.pid)).toEqual(['04', '05', '0C', '42']);
    expect(decoded.find(item => item?.pid === '05')?.signals[0].value).toBe(64);
    expect(decoded.find(item => item?.pid === '0C')?.signals[0].value).toBe(1000);
    expect(decoded.find(item => item?.pid === '42')?.signals[0].value).toBe(14);
  });
});
