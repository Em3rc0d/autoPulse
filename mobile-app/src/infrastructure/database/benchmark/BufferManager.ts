import { Obd2AcquisitionEvent } from './PayloadAdapter';
import { BenchmarkConfig } from './TelemetryGenerator';

export interface TelemetryBlock {
  sequenceNumber: number;
  windowStart: number;
  windowEnd: number;
  samples: Obd2AcquisitionEvent[];
  sampleCount: number;
  signalCount: number;
}

export class BufferManager {
  private currentBlock: Obd2AcquisitionEvent[] = [];
  private currentWindowStart = 0;
  private currentWindowEnd = 0;
  private sequenceNumber = 1;
  public maxBufferedSamples = 0;

  private droppedSamples = 0;

  constructor(
    private config: any,
    private onBlockReady: (block: TelemetryBlock) => void
  ) {}

  resetStats() {
    this.droppedSamples = 0;
  }

  getStats() {
    return { droppedSamples: this.droppedSamples };
  }

  addSample(event: Obd2AcquisitionEvent) {
    const timestamp = Date.now();

    if (this.currentBlock.length === 0) {
      this.currentWindowStart = timestamp;
      this.currentWindowEnd = timestamp + this.config.blockDurationMs;
    }

    if (timestamp > this.currentWindowEnd) {
      this.flush(timestamp);
    }

    this.currentBlock.push(event);
    if (this.currentBlock.length > this.maxBufferedSamples) {
      this.maxBufferedSamples = this.currentBlock.length;
    }
  }

  flush(windowEnd: number) {
    if (this.currentBlock.length === 0) return;

    const block: TelemetryBlock = {
      windowStart: this.currentWindowStart,
      windowEnd,
      samples: [...this.currentBlock],
      sampleCount: this.currentBlock.length,
      signalCount: 0,
      sequenceNumber: this.sequenceNumber++
    };

    this.onBlockReady(block);

    // Reset buffer
    this.currentBlock = [];
    this.currentWindowStart = windowEnd;
  }
}
