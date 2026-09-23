import { EncodedTelemetryBlock } from '../../domain/telemetry/models/EncodedTelemetryBlock';
import { ITelemetryBlockRepository } from '../../domain/telemetry/repositories/TelemetryBlockRepository';

export type CommitQueueEvent =
  | { type: 'COMMITTED'; block: EncodedTelemetryBlock }
  | { type: 'FAILED'; errorReason: string; block: EncodedTelemetryBlock };

export class TelemetryCommitQueueDrainTimeoutError extends Error {
  constructor(public readonly timeoutMs: number, public readonly pendingCount: number) {
    super(`TELEMETRY_DRAIN_TIMEOUT:${timeoutMs}ms:${pendingCount}_pending`);
    this.name = 'TelemetryCommitQueueDrainTimeoutError';
  }
}

// Blocks are normally emitted every 5 seconds. Eight pending blocks represents
// roughly forty seconds of persistence lag. Beyond that point continuing to
// acquire indefinitely risks unbounded memory growth and a misleading "recording"
// state, so the session must fail closed and preserve the evidence already queued.
export const MAX_PENDING_TELEMETRY_BLOCKS = 8;

export class TelemetryCommitQueue {
  private queue: EncodedTelemetryBlock[] = [];
  private isProcessing = false;
  private hasFailed = false;

  constructor(
    private readonly workspaceId: string,
    private readonly sessionId: string,
    private readonly repository: ITelemetryBlockRepository,
    private readonly onEvent: (event: CommitQueueEvent) => void
  ) {}

  public enqueue(block: EncodedTelemetryBlock) {
    if (this.hasFailed) return; // Do not enqueue more if we are already failed

    if (this.queue.length >= MAX_PENDING_TELEMETRY_BLOCKS) {
      this.hasFailed = true;
      this.onEvent({
        type: 'FAILED',
        errorReason: 'TELEMETRY_BACKPRESSURE_OVERFLOW',
        block,
      });
      return;
    }

    this.queue.push(block);
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0 || this.hasFailed) {
      return;
    }

    this.isProcessing = true;
    const block = this.queue[0];

    // Attempt 1
    let result = await this.repository.commitBlock(this.workspaceId, this.sessionId, block);

    // Check if retryable
    if (!result.success) {
      if (this.isRetryable((result as any).reason)) {
        // Retry exactly once with identical block. Repository writes are idempotent
        // by session + block sequence + byte-identical payload.
        result = await this.repository.commitBlock(this.workspaceId, this.sessionId, block);
      }
    }

    // A backpressure overflow may have failed the queue while an older database
    // write was still in flight. That completed write remains durable evidence, but
    // the queue must not resume normal processing after the terminal failure.
    if (this.hasFailed) {
      this.isProcessing = false;
      return;
    }

    if (!result.success) {
      this.hasFailed = true;
      // We retain the block in the queue (do not shift)
      this.onEvent({ type: 'FAILED', errorReason: (result as any).reason, block });
      this.isProcessing = false;
      return;
    }

    // Success
    this.queue.shift(); // Remove from queue
    this.onEvent({ type: 'COMMITTED', block });

    this.isProcessing = false;
    this.processNext();
  }

  /**
   * Wait until all queued blocks are committed, but never indefinitely.
   *
   * A hung native/SQLite write must not be able to keep a Live session in
   * FLUSHING forever. The caller owns the policy for converting a timeout
   * into an INTERRUPTED session.
   */
  public async drain(timeoutMs = 5000, pollIntervalMs = 50): Promise<void> {
    if (timeoutMs <= 0) {
      throw new Error('INVALID_DRAIN_TIMEOUT');
    }

    const startedAt = Date.now();

    while (this.queue.length > 0 && !this.hasFailed) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new TelemetryCommitQueueDrainTimeoutError(timeoutMs, this.queue.length);
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getHasFailed(): boolean {
    return this.hasFailed;
  }

  private isRetryable(reason: string): boolean {
    // Retry only transient failures
    return reason === 'DATABASE_WRITE_FAILED' || reason === 'CONCURRENT_SESSION_UPDATE';
  }
}
