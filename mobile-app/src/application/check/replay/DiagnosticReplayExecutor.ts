import type { PlannedDiagnosticRequest } from '../planner/DiagnosticScanPlanner';
import type { PlannedDiagnosticExecutionReceipt, PlannedDiagnosticExecutor } from './DiagnosticExecutionPort';
import {
  assertValidDiagnosticReplayFixture,
  DiagnosticReplayEvent,
  DiagnosticReplayFixture,
  diagnosticReplayScriptKey,
} from './DiagnosticReplayFixture';

export class DiagnosticReplayFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagnosticReplayFixtureError';
  }
}

/**
 * Deterministic offline executor. It never serializes a wire command and never
 * implements DiagnosticConnector; live connector adaptation remains H3-gated.
 */
export class DiagnosticReplayExecutor implements PlannedDiagnosticExecutor {
  private readonly fixture: DiagnosticReplayFixture;
  private readonly cursors = new Map<string, number>();

  constructor(fixture: DiagnosticReplayFixture) {
    assertValidDiagnosticReplayFixture(fixture);
    this.fixture = fixture;
  }

  reset(): void {
    this.cursors.clear();
  }

  async executeCommand(
    request: PlannedDiagnosticRequest,
    _attemptIndex: number,
    startedAt: number,
  ): Promise<PlannedDiagnosticExecutionReceipt> {
    return this.consume(request, 'COMMAND_RESPONSE', startedAt);
  }

  async awaitPendingContinuation(
    request: PlannedDiagnosticRequest,
    _pendingExtensionIndex: number,
    startedAt: number,
    maxWaitMs: number,
  ): Promise<PlannedDiagnosticExecutionReceipt> {
    if (!Number.isInteger(maxWaitMs) || maxWaitMs < 1) {
      throw new DiagnosticReplayFixtureError('Pending continuation maxWaitMs must be a positive integer');
    }
    const receipt = this.consume(request, 'PENDING_CONTINUATION', startedAt);
    if (receipt.finishedAt - receipt.startedAt > maxWaitMs) {
      throw new DiagnosticReplayFixtureError(
        `Replay pending continuation exceeded policy window for ${request.semanticId}`,
      );
    }
    return receipt;
  }

  private consume(
    request: PlannedDiagnosticRequest,
    expectedKind: DiagnosticReplayEvent['kind'],
    startedAt: number,
  ): PlannedDiagnosticExecutionReceipt {
    if (!Number.isFinite(startedAt)) {
      throw new DiagnosticReplayFixtureError('Replay execution startedAt must be finite');
    }
    if (this.fixture.protocol !== request.supportedProtocols.find(protocol => protocol === this.fixture.protocol)) {
      throw new DiagnosticReplayFixtureError(
        `Replay fixture protocol ${this.fixture.protocol} is not promoted for ${request.semanticId}`,
      );
    }

    const key = diagnosticReplayScriptKey(request.semanticId, request.targetEndpointId);
    const script = this.fixture.scripts.find(
      candidate => diagnosticReplayScriptKey(candidate.semanticId, candidate.targetEndpointId) === key,
    );
    if (!script) {
      throw new DiagnosticReplayFixtureError(`No replay script for planned request ${key}`);
    }

    const cursor = this.cursors.get(key) ?? 0;
    const event = script.events[cursor];
    if (!event) {
      throw new DiagnosticReplayFixtureError(`Replay script exhausted for ${key}`);
    }
    if (event.kind !== expectedKind) {
      throw new DiagnosticReplayFixtureError(
        `Replay event kind mismatch for ${key}: expected ${expectedKind}, got ${event.kind}`,
      );
    }

    const finishedAt = startedAt + event.durationMs;
    if (event.envelope.observedAt !== finishedAt) {
      throw new DiagnosticReplayFixtureError(
        `Replay envelope observedAt mismatch for ${key}: expected ${finishedAt}, got ${event.envelope.observedAt}`,
      );
    }
    if (event.envelope.requestService.toUpperCase() !== request.service.toUpperCase()) {
      throw new DiagnosticReplayFixtureError(
        `Replay envelope request service mismatch for ${key}`,
      );
    }

    this.cursors.set(key, cursor + 1);
    return Object.freeze({
      envelope: event.envelope,
      observedResponseBytes: event.observedResponseBytes,
      startedAt,
      finishedAt,
    });
  }
}
