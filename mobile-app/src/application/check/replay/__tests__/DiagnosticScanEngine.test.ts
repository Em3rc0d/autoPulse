import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import { runDiagnosticScan } from '../DiagnosticScanEngine';
import {
  CHECK_REPLAY_DISCONNECT_KWP,
  CHECK_REPLAY_MULTI_STATUS_KWP,
  CHECK_REPLAY_RESPONSE_PENDING_KWP,
  CHECK_REPLAY_STORED_SINGLE_CAN,
  CHECK_REPLAY_STORED_SINGLE_KWP,
  CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP,
  CHECK_REPLAY_ZERO_DTC_KWP,
} from '../fixtures/DiagnosticReplayCorpusV1';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';

const planFor = (
  fixture: DiagnosticReplayFixture,
  semanticIds: readonly string[],
  retryableOutcomes: readonly ('TIMEOUT' | 'NO_DATA' | 'FAILED')[] = [],
  maxRetries = 0,
  maxPendingExtensions = 1,
) => buildDiagnosticScanPlan({
  planId: `plan:${fixture.fixtureId}`,
  createdAt: fixture.startedAt,
  protocol: fixture.protocol,
  registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  proposals: semanticIds.map((semanticId, index) => ({
    semanticId,
    required: index < 2,
    targetEndpointId: 'ecu-engine',
  })),
  budget: {
    maxCommands: 8,
    maxResponseBytes: 4096,
    maxBytesPerResponse: 1024,
    maxElapsedMs: 5000,
    minInterCommandDelayMs: 0,
    provenance: 'mk6-test-budget',
  },
  retryPolicy: {
    maxRetries,
    retryableOutcomes,
    responsePending: { maxExtensions: maxPendingExtensions, extensionMs: 100 },
    provenance: 'mk6-test-retry',
  },
  deadlinePolicy: {
    overallDeadlineMs: 5000,
    stageDeadlineMs: { CAPABILITY_DISCOVERY: 1000, DTC_CORE: 4000 },
    provenance: 'mk6-test-deadline',
  },
});

const DTC_CORE = [
  'check.obd.mode03.stored-dtc',
  'check.obd.mode07.pending-dtc',
  'check.obd.mode0a.permanent-dtc',
] as const;

describe('CHECK-MK6 DiagnosticScanEngine replay', () => {
  it('replays a deterministic zero-DTC KWP scan without claiming vehicle health', async () => {
    const plan = planFor(CHECK_REPLAY_ZERO_DTC_KWP, DTC_CORE);
    const first = await runDiagnosticScan({
      plan,
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_ZERO_DTC_KWP),
    });
    const second = await runDiagnosticScan({
      plan,
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_ZERO_DTC_KWP),
    });

    expect(first).toEqual(second);
    expect(first.state).toBe('COMPLETE');
    expect(first.usage.commandsIssued).toBe(3);
    expect(first.dtcResults.map(item => item.outcome)).toEqual([
      'SUCCESS_ZERO_CODES',
      'SUCCESS_ZERO_CODES',
      'SUCCESS_ZERO_CODES',
    ]);
    expect(first.limitations).toEqual([]);
  });

  it('preserves the same DTC across stored/pending status observations', async () => {
    const result = await runDiagnosticScan({
      plan: planFor(CHECK_REPLAY_MULTI_STATUS_KWP, DTC_CORE),
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_MULTI_STATUS_KWP),
    });

    expect(result.state).toBe('COMPLETE');
    expect(result.dtcResults[0].status).toBe('STORED');
    expect(result.dtcResults[0].codes[0].code).toBe('P0133');
    expect(result.dtcResults[1].status).toBe('PENDING');
    expect(result.dtcResults[1].codes[0].code).toBe('P0133');
    expect(result.dtcResults[2].status).toBe('PERMANENT');
    expect(result.dtcResults[2].codes[0].code).toBe('P0420');
  });

  it('uses an explicitly allowed timeout retry and counts the second command', async () => {
    const result = await runDiagnosticScan({
      plan: planFor(
        CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP,
        ['check.obd.mode03.stored-dtc'],
        ['TIMEOUT'],
        1,
      ),
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP),
    });

    expect(result.state).toBe('COMPLETE');
    expect(result.usage.commandsIssued).toBe(2);
    expect(result.attempts.map(item => item.outcome)).toEqual(['TIMEOUT', 'SUCCESS']);
    expect(result.dtcResults.at(-1)?.codes[0].code).toBe('P0133');
  });

  it('handles RESPONSE_PENDING as continuation without issuing a second command', async () => {
    const result = await runDiagnosticScan({
      plan: planFor(CHECK_REPLAY_RESPONSE_PENDING_KWP, ['check.obd.mode03.stored-dtc']),
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_RESPONSE_PENDING_KWP),
    });

    expect(result.state).toBe('COMPLETE');
    expect(result.usage.commandsIssued).toBe(1);
    expect(result.attempts.map(item => [item.eventKind, item.outcome])).toEqual([
      ['COMMAND_RESPONSE', 'RESPONSE_PENDING'],
      ['PENDING_CONTINUATION', 'SUCCESS'],
    ]);
  });

  it('terminates as DISCONNECTED while preserving the observed attempt', async () => {
    const result = await runDiagnosticScan({
      plan: planFor(CHECK_REPLAY_DISCONNECT_KWP, ['check.obd.mode03.stored-dtc']),
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_DISCONNECT_KWP),
    });

    expect(result.state).toBe('DISCONNECTED');
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].outcome).toBe('DISCONNECTED');
  });

  it('replays the fixture-promoted CAN Mode 03 count-byte envelope', async () => {
    const result = await runDiagnosticScan({
      plan: planFor(CHECK_REPLAY_STORED_SINGLE_CAN, ['check.obd.mode03.stored-dtc']),
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_STORED_SINGLE_CAN),
    });

    expect(result.state).toBe('COMPLETE');
    expect(result.dtcResults[0].declaredCount).toBe(1);
    expect(result.dtcResults[0].codes[0].code).toBe('P0133');
  });

  it('fails closed when the replay corpus lacks a script for a planned request', async () => {
    const plan = planFor(CHECK_REPLAY_STORED_SINGLE_KWP, [
      'check.obd.mode03.stored-dtc',
      'check.obd.mode07.pending-dtc',
    ]);
    const result = await runDiagnosticScan({
      plan,
      executor: new DiagnosticReplayExecutor(CHECK_REPLAY_STORED_SINGLE_KWP),
    });

    expect(result.state).toBe('FAILED');
    expect(result.limitations.some(item => item.includes('No replay script'))).toBe(true);
  });
});
