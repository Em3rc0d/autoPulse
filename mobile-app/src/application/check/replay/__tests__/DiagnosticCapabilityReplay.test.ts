import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';
import { runDiagnosticScan } from '../DiagnosticScanEngine';

const fixture: DiagnosticReplayFixture = {
  fixtureId: 'mode01-support-00-kwp',
  protocol: 'ISO_14230_KWP',
  provenance: 'check-replay-corpus/synthetic-v1:SYNTHETIC_NOT_PHYSICAL_CERTIFICATION',
  startedAt: 1000,
  scripts: [{
    semanticId: 'check.obd.mode01.support.00',
    targetEndpointId: 'ecu-engine',
    events: [{
      kind: 'COMMAND_RESPONSE',
      durationMs: 10,
      observedResponseBytes: 6,
      envelope: {
        kind: 'POSITIVE_RESPONSE',
        requestService: '01',
        responseService: '41',
        // Service-aware envelope keeps the echoed PID byte before bitmap data.
        payload: [0x00, 0x00, 0x00, 0x00, 0x01],
        protocol: 'ISO_14230_KWP',
        sourceEndpointId: 'ecu-engine',
        provenance: 'synthetic:mode01-support-00',
        observedAt: 1010,
      },
    }],
  }],
};

const plan = buildDiagnosticScanPlan({
  planId: 'plan:mode01-support-00-kwp',
  createdAt: fixture.startedAt,
  protocol: fixture.protocol,
  registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  proposals: [{
    semanticId: 'check.obd.mode01.support.00',
    required: true,
    targetEndpointId: 'ecu-engine',
  }],
  budget: {
    maxCommands: 2,
    maxResponseBytes: 100,
    maxBytesPerResponse: 50,
    maxElapsedMs: 1000,
    minInterCommandDelayMs: 0,
    provenance: 'test',
  },
  retryPolicy: {
    maxRetries: 0,
    retryableOutcomes: [],
    responsePending: { maxExtensions: 1, extensionMs: 100 },
    provenance: 'test',
  },
  deadlinePolicy: {
    overallDeadlineMs: 1000,
    stageDeadlineMs: { CAPABILITY_DISCOVERY: 500, DTC_CORE: 1000 },
    provenance: 'test',
  },
});

describe('CHECK-MK6 capability replay integration', () => {
  it('validates the echoed PID byte and decodes only the four bitmap bytes', async () => {
    const result = await runDiagnosticScan({
      plan,
      executor: new DiagnosticReplayExecutor(fixture),
    });

    expect(result.state).toBe('COMPLETE');
    expect(result.pidSupportResults).toHaveLength(1);
    expect(result.pidSupportResults[0].command).toBe('0100');
    expect(result.pidSupportResults[0].advertisedPids).toContain('0120');
    expect(result.pidSupportResults[0].continuationCommand).toBe('0120');
  });
});
