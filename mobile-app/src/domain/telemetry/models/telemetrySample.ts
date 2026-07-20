import { LiveSessionId, SignalId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { ElapsedMs } from '../../shared/durations';
import { TelemetryValueOrigin, TelemetryQuality } from './enums';

export interface TelemetrySample {
  readonly sessionId: LiveSessionId;
  readonly signalId: SignalId;
  readonly timestamp: UtcIsoTimestamp;
  readonly elapsedMs: ElapsedMs;
  readonly value: number | string | boolean | null;
  readonly unit: string;
  readonly rawValue: any;
  readonly origin: TelemetryValueOrigin;
  readonly quality: TelemetryQuality;
}
