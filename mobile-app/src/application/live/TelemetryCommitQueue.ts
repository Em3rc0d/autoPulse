import { EncodedTelemetryBlock } from '../../domain/telemetry/models/EncodedTelemetryBlock';
import { ITelemetryBlockRepository } from '../../domain/telemetry/repositories/TelemetryBlockRepository';

export type CommitQueueEvent =
  | { type: 'COMMITTED'; block: EncodedTelemetryBlock }
  | { type: 'FAILED'; errorReason: string; block: EncodedTelemetryBlock };

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

  public async drain(): Promise<void> {
    while(this.queue.length > 0 && !this.hasFailed) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getHasFailed(): boolean {
    return this.hasFailed;
  }

  private isRetryable(reason: string): boolean {
    // Retry only transiant failures
    return reason === 'DATABASE_WRITE_FAILED' || reason === 'CONCURRENT_SESSION_UPDATE';
  }
}
