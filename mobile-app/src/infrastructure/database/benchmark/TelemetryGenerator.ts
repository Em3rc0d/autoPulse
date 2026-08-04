export interface TelemetrySample {
  timestamp: number;
  value: number;
  signalId: string;
}

export type BenchmarkLoadProfile = 'BASELINE' | 'HIGH_VOLUME';

export interface BenchmarkConfig {
  runId: string;
  loadProfile: BenchmarkLoadProfile;
  durationMs: number;
  blockDurationMs: number;
  signalsCount: number;
  hz: number;
}

export class TelemetryGenerator {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime = 0;

  constructor(
    private config: BenchmarkConfig,
    private onSample: (sample: TelemetrySample) => void,
    private onComplete: () => void
  ) {}

  start() {
    this.isRunning = true;
    this.startTime = Date.now();

    const intervalMs = 1000 / this.config.hz;
    const signals = Array.from({ length: this.config.signalsCount }, (_, i) => `sig_${i}`);

    this.intervalId = setInterval(() => {
      const now = Date.now();

      if (now - this.startTime >= this.config.durationMs) {
        this.stop();
        this.onComplete();
        return;
      }

      // Generate a sample for each signal
      for (const signalId of signals) {
        this.onSample({
          timestamp: now,
          value: Math.random() * 100, // Simulated value
          signalId
        });
      }
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
