import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import type { PlannedDiagnosticExecutionReceipt, PlannedDiagnosticExecutor } from '../DiagnosticExecutionPort';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';
import { runDiagnosticScan } from '../DiagnosticScanEngine';

const makePlan = (options: {
  semanticIds?: readonly string[];
  maxCommands?: number;
  maxBytesPerResponse?: number;
  minInterCommandDelayMs?: number;
  retryTimeout?: boolean;
} = {}) => buildDiagnosticScanPlan({
  planId: 'mk6-safety-gates',
  createdAt: 1000,
  protocol: 'ISO_14230_KWP',
  registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  proposals: (options.semanticIds ?? ['check.obd.mode03.stored-dtc']).map(semanticId => ({
    semanticId,
    required: true,
    targetEndpointId: 'ecu-engine',
  })),
  budget: {
    maxCommands: options.maxCommands ?? 4,
    maxResponseBytes: 100,
    maxBytesPerResponse: options.maxBytesPerResponse ?? 50,
    maxElapsedMs: 5000,
    minInterCommandDelayMs: options.minInterCommandDelayMs ?? 0,
    provenance: 'mk6-safety-test',
  },
  retryPolicy: {
    maxRetries: options.retryTimeout ? 1 : 0,
    retryableOutcomes: options.retryTimeout ? ['TIMEOUT'] : [],
    responsePending: { maxExtensions: 1, extensionMs: 100 },
    provenance: 'mk6-safety-test',
  },
  deadlinePolicy: {
    overallDeadlineMs: 5000,
    stageDeadlineMs: { CAPABILITY_DISCOVERY: 1000, DTC_CORE: 4000 },
    provenance: 'mk6-safety-test',
  },
});

const noDataFixture = (observedResponseBytes = 0): DiagnosticReplayFixture => ({
  fixtureId: 'mk6-no-data-safety',
  protocol: 'ISO_14230_KWP',
  provenance: 'SYNTHETIC_NOT_PHYSICAL_CERTIFICATION',
  startedAt: 1000,
  scripts: [{
    semanticId: 'check.obd.mode03.stored-dtc',
    targetEndpointId: 'ecu-engine',
    events: [{
      kind: 'COMMAND_RESPONSE',
      durationMs: 10,
      observedResponseBytes,
      envelope: {
        kind: 'NO_DATA',
        requestService: '03',
        protocol: 'ISO_14230_KWP',
        sourceEndpointId: 'ecu-engine',
        provenance: 'synthetic:no-data',
        observedAt: 1010,
      },
    }],
  }],
});

function positiveEnvelope(
  requestService: string,
  responseService: string,
  observedAt: number,
): DiagnosticServiceEnvelope {
  return {
    kind: 'POSITIVE_RESPONSE',
    requestService,
    responseService,
    payload: [0x00, 0x00],
    protocol: 'ISO_14230_KWP',
    sourceEndpointId: 'ecu-engine',
    provenance: 'synthetic:pacing',
    observedAt,
  };
}

describe('CHECK-MK6 execution safety gates', () => {
  it('cancels before any executor call when cancellation is already requested', async () => {
    let calls = 0;
    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(): Promise<PlannedDiagnosticExecutionReceipt> {
        calls += 1;
        throw new Error('must not execute');
      },
      async awaitPendingContinuation(): Promise<PlannedDiagnosticExecutionReceipt> {
        calls += 1;
        throw new Error('must not continue');
      },
    };

    const result = await runDiagnosticScan({
      plan: makePlan(),
      executor,
      cancelRequestedAt: 1000,
    });

    expect(result.state).toBe('CANCELLED');
    expect(result.usage.commandsIssued).toBe(0);
    expect(calls).toBe(0);
  });

  it('fails a required request when an observed response exceeds the per-response byte ceiling', async () => {
    const result = await runDiagnosticScan({
      plan: makePlan({ maxBytesPerResponse: 2 }),
      executor: new DiagnosticReplayExecutor(noDataFixture(3)),
    });

    expect(result.state).toBe('FAILED');
    expect(result.limitations).toContain(
      'response-budget:check.obd.mode03.stored-dtc:RESPONSE_BYTE_CEILING_EXCEEDED',
    );
  });

  it('does not let a retry escape the total command budget', async () => {
    let calls = 0;
    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(request, _attemptIndex, startedAt) {
        calls += 1;
        return {
          observedResponseBytes: 0,
          startedAt,
          finishedAt: startedAt + 10,
          envelope: {
            kind: 'TIMEOUT',
            requestService: request.service,
            protocol: 'ISO_14230_KWP',
            sourceEndpointId: request.targetEndpointId,
            provenance: 'synthetic:timeout',
            observedAt: startedAt + 10,
          },
        };
      },
      async awaitPendingContinuation() {
        throw new Error('not expected');
      },
    };

    const result = await runDiagnosticScan({
      plan: makePlan({ maxCommands: 1, retryTimeout: true }),
      executor,
    });

    expect(result.state).toBe('FAILED');
    expect(result.usage.commandsIssued).toBe(1);
    expect(calls).toBe(1);
    expect(result.limitations).toContain(
      'gate:check.obd.mode03.stored-dtc:COMMAND_BUDGET_EXHAUSTED',
    );
  });

  it('paces the next command from the final RESPONSE_PENDING continuation boundary', async () => {
    const commandStarts: number[] = [];
    let firstCommand = true;

    const executor: PlannedDiagnosticExecutor = {
      async executeCommand(request, _attemptIndex, startedAt) {
        commandStarts.push(startedAt);
        if (firstCommand) {
          firstCommand = false;
          return {
            observedResponseBytes: 3,
            startedAt,
            finishedAt: startedAt + 10,
            envelope: {
              kind: 'NEGATIVE_RESPONSE',
              requestService: request.service,
              negativeResponseCode: '78',
              protocol: 'ISO_14230_KWP',
              sourceEndpointId: request.targetEndpointId,
              provenance: 'synthetic:pending',
              observedAt: startedAt + 10,
            },
          };
        }
        return {
          observedResponseBytes: 3,
          startedAt,
          finishedAt: startedAt + 10,
          envelope: positiveEnvelope(request.service, request.expectedResponseService, startedAt + 10),
        };
      },
      async awaitPendingContinuation(request, _pendingExtensionIndex, startedAt) {
        return {
          observedResponseBytes: 3,
          startedAt,
          finishedAt: startedAt + 50,
          envelope: positiveEnvelope(request.service, request.expectedResponseService, startedAt + 50),
        };
      },
    };

    const result = await runDiagnosticScan({
      plan: makePlan({
        semanticIds: [
          'check.obd.mode03.stored-dtc',
          'check.obd.mode07.pending-dtc',
        ],
        minInterCommandDelayMs: 100,
      }),
      executor,
    });

    expect(result.state).toBe('COMPLETE');
    // 1000 command → 1010 pending → 1060 final continuation → 100ms quiet time.
    expect(commandStarts).toEqual([1000, 1160]);
    expect(result.usage.commandsIssued).toBe(2);
  });
});
