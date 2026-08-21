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
        // Retry exactly once with identical block
        result = await this.repository.commitBlock(this.workspaceId, this.sessionId, block);
      }
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
