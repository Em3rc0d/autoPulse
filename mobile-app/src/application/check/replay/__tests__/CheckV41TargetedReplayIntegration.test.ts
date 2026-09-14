import { CHECK_CORE_DESCRIPTOR_REGISTRY_V3 } from '../../planner/DiagnosticDescriptorRegistryV3';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';
import { runDiagnosticScan } from '../DiagnosticScanEngine';

const readinessFixture: DiagnosticReplayFixture = Object.freeze({
  fixtureId: 'check-v4.1-targeted-0101-synthetic',
  protocol: 'ISO_14230_KWP',
  provenance: 'SYNTHETIC_NOT_PHYSICAL_CERTIFICATION: CHECK v4.1 planner-to-executor authorization regression',
  startedAt: 1000,
  scripts: Object.freeze([{
    semanticId: 'check.obd.mode01.observe.01',
    targetEndpointId: null,
    events: Object.freeze([{
      kind: 'COMMAND_RESPONSE',
      durationMs: 5,
      observedResponseBytes: 6,
      envelope: Object.freeze({
        kind: 'POSITIVE_RESPONSE' as const,
        requestService: '01',
        responseService: '41',
        payload: Object.freeze([0x01, 0x80, 0x07, 0xe1, 0x00]),
        protocol: 'ISO_14230_KWP' as const,
        sourceEndpointId: null,
        provenance: 'synthetic 0101 response for authorization regression',
        observedAt: 1005,
        rawText: '41018007E100',
      }),
    }]),
  }]),
});

function readinessPlan() {
  return buildDiagnosticScanPlan({
    planId: 'check-v4.1-targeted-0101',
    createdAt: readinessFixture.startedAt,
    protocol: readinessFixture.protocol,
    registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
    proposals: [{
      semanticId: 'check.obd.mode01.observe.01',
      required: true,
      rationaleEvidenceIds: ['planner:check-evidence-planner/v2', 'bounded-fallback'],
    }],
    budget: {
      maxCommands: 1,
      maxResponseBytes: 512,
      maxBytesPerResponse: 64,
      maxElapsedMs: 5000,
      minInterCommandDelayMs: 0,
      provenance: 'v4.1 targeted replay integration',
    },
    retryPolicy: {
      maxRetries: 0,
      retryableOutcomes: [],
      responsePending: { maxExtensions: 0, extensionMs: 100 },
      provenance: 'v4.1 targeted replay integration',
    },
    deadlinePolicy: {
      overallDeadlineMs: 5000,
      stageDeadlineMs: { TARGETED_PID_ACQUISITION: 4000 },
      provenance: 'v4.1 targeted replay integration',
    },
  });
}

describe('CHECK v4.1 targeted planner → executor integration', () => {
  it('executes canonical 0101 exactly once and preserves it as direct evidence', async () => {
    const plan = readinessPlan();
    expect(plan.status).toBe('READY');
    expect(plan.requests.map(request => `${request.service}${request.pid}`)).toEqual(['0101']);

    const result = await runDiagnosticScan({
      plan,
      executor: new DiagnosticReplayExecutor(readinessFixture),
    });

    expect(result.state).toBe('COMPLETE');
    expect(result.usage.commandsIssued).toBe(1);
    expect(result.attempts).toHaveLength(1);
    expect(result.mode01DirectResults).toHaveLength(1);
    expect(result.mode01DirectResults[0]).toEqual(expect.objectContaining({
      requestPid: '01',
      outcome: 'OBSERVED_DIRECTLY',
      dataBytes: [0x80, 0x07, 0xe1, 0x00],
    }));
  });
});
