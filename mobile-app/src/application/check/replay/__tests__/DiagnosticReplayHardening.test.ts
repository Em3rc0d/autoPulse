import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import type { PlannedDiagnosticExecutionReceipt, PlannedDiagnosticExecutor } from '../DiagnosticExecutionPort';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import {
  assertValidDiagnosticReplayFixture,
  type DiagnosticReplayFixture,
} from '../DiagnosticReplayFixture';
import { runDiagnosticScan } from '../DiagnosticScanEngine';

const START = 1000;
const SEMANTIC = 'check.obd.mode03.stored-dtc';

function makePlan(options: {
  targetEndpointId?: string | null;
  maxBytesPerResponse?: number;
  maxResponseBytes?: number;
  maxElapsedMs?: number;
  deadlineMs?: number;
  maxPendingExtensions?: number;
} = {}) {
  const deadlineMs = options.deadlineMs ?? 1000;
  return buildDiagnosticScanPlan({
    planId: 'mk9-replay-hardening',
    createdAt: START,
    protocol: 'ISO_14230_KWP',
    registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
    proposals: [{
      semanticId: SEMANTIC,
      required: true,
      targetEndpointId: options.targetEndpointId === undefined ? null : options.targetEndpointId,
    }],
    budget: {
      maxCommands: 4,
      maxResponseBytes: options.maxResponseBytes ?? 100,
      maxBytesPerResponse: options.maxBytesPerResponse ?? 50,
      maxElapsedMs: options.maxElapsedMs ?? 2000,
      minInterCommandDelayMs: 0,
      provenance: 'mk9:test-budget',
    },
    retryPolicy: {
      maxRetries: 0,
      retryableOutcomes: [],
      responsePending: { maxExtensions: options.maxPendingExtensions ?? 1, extensionMs: Math.min(100, Math.max(1, deadlineMs - 1)) },
      provenance: 'mk9:test-retry',
    },
    deadlinePolicy: {
      overallDeadlineMs: deadlineMs,
      stageDeadlineMs: { CAPABILITY_DISCOVERY: deadlineMs, DTC_CORE: deadlineMs },
      provenance: 'mk9:test-deadline',
    },
  });
}

function positive(sourceEndpointId: string | null, observedAt: number, payload: readonly number[] = [0x01, 0x33]): DiagnosticServiceEnvelope {
  return {
    kind: 'POSITIVE_RESPONSE',
    requestService: '03',
    responseService: '43',
    payload,
    protocol: 'ISO_14230_KWP',
    sourceEndpointId,
    provenance: 'mk9:test-positive',
    observedAt,
  };
}

function pending(sourceEndpointId: string | null, observedAt: number): DiagnosticServiceEnvelope {
  return {
    kind: 'NEGATIVE_RESPONSE',
    requestService: '03',
    negativeResponseCode: '78',
    protocol: 'ISO_14230_KWP',
    sourceEndpointId,
    provenance: 'mk9:test-pending',
    observedAt,
  };
}

function receipt(
  startedAt: number,
  finishedAt: number,
  responses: readonly { envelope: DiagnosticServiceEnvelope; observedResponseBytes: number }[],
): PlannedDiagnosticExecutionReceipt {
  return { startedAt, finishedAt, responses };
}

describe('CHECK-MK9 replay transaction hardening', () => {
  it('continues SUCCESS + RESPONSE_PENDING responders without issuing a second semantic command', async () => {
    let commandCalls = 0;
    let continuationCalls = 0;
    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(_request, _attemptIndex, startedAt) {
        commandCalls += 1;
        return receipt(startedAt, startedAt + 10, [
          { envelope: positive('ecu-a', startedAt + 10), observedResponseBytes: 3 },
          { envelope: pending('ecu-b', startedAt + 10), observedResponseBytes: 3 },
        ]);
      },
      async awaitPendingContinuation(_request, _pendingIndex, startedAt) {
        continuationCalls += 1;
        return receipt(startedAt, startedAt + 10, [
          { envelope: positive('ecu-b', startedAt + 10, [0x04, 0x20]), observedResponseBytes: 3 },
        ]);
      },
    };

    const result = await runDiagnosticScan({ plan: makePlan(), executor });
    expect(result.state).toBe('COMPLETE');
    expect(result.usage.commandsIssued).toBe(1);
    expect(commandCalls).toBe(1);
    expect(continuationCalls).toBe(1);
    expect(result.attempts.map(item => item.outcome)).toEqual(['SUCCESS', 'RESPONSE_PENDING', 'SUCCESS']);
    expect(result.dtcResults.map(item => item.codes.map(code => code.code))).toEqual([['P0133'], [], ['P0420']]);
  });

  it('does not accept a response that completes after the deterministic deadline', async () => {
    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(_request, _attemptIndex, startedAt) {
        return receipt(startedAt, startedAt + 10, [
          { envelope: positive('ecu-a', startedAt + 10), observedResponseBytes: 3 },
        ]);
      },
      async awaitPendingContinuation() { throw new Error('not expected'); },
    };

    const result = await runDiagnosticScan({ plan: makePlan({ deadlineMs: 5 }), executor });
    expect(result.state).toBe('FAILED');
    expect(result.attempts.map(item => item.outcome)).toEqual(['DEADLINE_EXCEEDED']);
    expect(result.dtcResults).toEqual([]);
    expect(result.usage.responseBytes).toBe(3);
    expect(result.limitations).toContain(`post-response-deadline:${SEMANTIC}:DEADLINE_EXCEEDED`);
  });

  it('preserves an already-arrived response but stops after cancellation during an in-flight command', async () => {
    let calls = 0;
    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(_request, _attemptIndex, startedAt) {
        calls += 1;
        return receipt(startedAt, startedAt + 10, [
          { envelope: positive('ecu-a', startedAt + 10), observedResponseBytes: 3 },
        ]);
      },
      async awaitPendingContinuation() { throw new Error('not expected'); },
    };

    const result = await runDiagnosticScan({ plan: makePlan(), executor, cancelRequestedAt: START + 5 });
    expect(result.state).toBe('CANCELLED');
    expect(calls).toBe(1);
    expect(result.attempts.map(item => item.outcome)).toEqual(['SUCCESS']);
    expect(result.dtcResults[0].codes[0].code).toBe('P0133');
    expect(result.limitations).toContain(`cancelled-after-response:${SEMANTIC}`);
  });

  it('accounts bytes that physically arrived even when the byte ceiling rejects them as evidence', async () => {
    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(_request, _attemptIndex, startedAt) {
        return receipt(startedAt, startedAt + 10, [
          { envelope: positive('ecu-a', startedAt + 10), observedResponseBytes: 3 },
        ]);
      },
      async awaitPendingContinuation() { throw new Error('not expected'); },
    };

    const result = await runDiagnosticScan({ plan: makePlan({ maxBytesPerResponse: 2 }), executor });
    expect(result.state).toBe('FAILED');
    expect(result.usage.responseBytes).toBe(3);
    expect(result.dtcResults).toEqual([]);
    expect(result.limitations).toContain(`response-budget:${SEMANTIC}:RESPONSE_BYTE_CEILING_EXCEEDED`);
  });

  it('fails before parsing on protocol mismatch or duplicate normalized responder identity', async () => {
    const protocolMismatch: PlannedDiagnosticExecutor = {
      async executeCommand(_request, _attemptIndex, startedAt) {
        const bad: DiagnosticServiceEnvelope = {
          ...positive('ecu-a', startedAt + 10),
          protocol: 'ISO_15765_CAN',
        };
        return receipt(startedAt, startedAt + 10, [{ envelope: bad, observedResponseBytes: 3 }]);
      },
      async awaitPendingContinuation() { throw new Error('not expected'); },
    };
    const protocolResult = await runDiagnosticScan({ plan: makePlan(), executor: protocolMismatch });
    expect(protocolResult.state).toBe('FAILED');
    expect(protocolResult.attempts).toEqual([]);
    expect(protocolResult.limitations).toContain(`executor:${SEMANTIC}:RESPONSE_PROTOCOL_MISMATCH`);

    const duplicateResponder: PlannedDiagnosticExecutor = {
      async executeCommand(_request, _attemptIndex, startedAt) {
        return receipt(startedAt, startedAt + 10, [
          { envelope: positive('ecu-a', startedAt + 10), observedResponseBytes: 3 },
          { envelope: positive('ecu-a', startedAt + 10, [0x04, 0x20]), observedResponseBytes: 3 },
        ]);
      },
      async awaitPendingContinuation() { throw new Error('not expected'); },
    };
    const duplicateResult = await runDiagnosticScan({ plan: makePlan(), executor: duplicateResponder });
    expect(duplicateResult.state).toBe('FAILED');
    expect(duplicateResult.limitations).toContain(`executor:${SEMANTIC}:DUPLICATE_NORMALIZED_RESPONDER`);
  });

  it('rejects malformed pending-continuation scripts before replay execution', () => {
    const invalid: DiagnosticReplayFixture = {
      fixtureId: 'pending-without-nrc78',
      protocol: 'ISO_14230_KWP',
      provenance: 'mk9:test-invalid-fixture',
      startedAt: START,
      scripts: [{
        semanticId: SEMANTIC,
        targetEndpointId: 'ecu-a',
        events: [{
          kind: 'PENDING_CONTINUATION',
          durationMs: 1,
          observedResponseBytes: 3,
          envelope: positive('ecu-a', START + 1),
        }],
      }],
    };
    expect(() => assertValidDiagnosticReplayFixture(invalid)).toThrow('must begin with COMMAND_RESPONSE');
  });

  it('detects replay evidence that a passing scan silently left unconsumed', async () => {
    const fixture: DiagnosticReplayFixture = {
      fixtureId: 'extra-evidence',
      protocol: 'ISO_14230_KWP',
      provenance: 'mk9:test-extra-evidence',
      startedAt: START,
      scripts: [{
        semanticId: SEMANTIC,
        targetEndpointId: null,
        events: [
          {
            kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
            envelope: positive('ecu-a', START + 10),
          },
          {
            kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
            envelope: positive('ecu-a', START + 20, [0x04, 0x20]),
          },
        ],
      }],
    };
    const executor = new DiagnosticReplayExecutor(fixture);
    const result = await runDiagnosticScan({ plan: makePlan(), executor });
    expect(result.state).toBe('COMPLETE');
    expect(() => executor.assertFullyConsumed()).toThrow('unconsumed evidence');
  });
});
