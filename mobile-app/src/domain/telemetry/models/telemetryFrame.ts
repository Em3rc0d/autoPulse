import { LiveSessionId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { ElapsedMs, SequenceNumber } from '../../shared/durations';
import { TelemetrySample } from './telemetrySample';
import { ConnectionQualitySummary } from '../../acquisition/models/connectionQuality';

export interface TelemetryFrame {
  readonly sessionId: LiveSessionId;
  readonly timestamp: UtcIsoTimestamp;
  readonly elapsedMs: ElapsedMs;
  readonly sequenceNumber: SequenceNumber;
  readonly samples: readonly TelemetrySample[];
  readonly connectionQuality?: ConnectionQualitySummary;
}
