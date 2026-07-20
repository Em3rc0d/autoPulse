import { MarkerId, LiveSessionId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { ElapsedMs, DurationMs } from '../../shared/durations';
import { TelemetryMarkerType } from './enums';

export interface TelemetryMarker {
  readonly id: MarkerId;
  readonly sessionId: LiveSessionId;
  readonly type: TelemetryMarkerType;
  readonly timestamp: UtcIsoTimestamp;
  readonly elapsedMs: ElapsedMs;
  readonly note?: string;
  readonly preWindowMs?: DurationMs;
  readonly postWindowMs?: DurationMs;
}
