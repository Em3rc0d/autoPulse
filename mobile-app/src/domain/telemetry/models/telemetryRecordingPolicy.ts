import { DurationMs } from '../../shared/durations';

export type RecordingMode = 'OFF' | 'MANUAL' | 'CIRCULAR_BUFFER' | 'MARKER_WINDOWS';

export interface TelemetryRecordingPolicy {
  readonly mode: RecordingMode;
  readonly maxDurationMs?: DurationMs;
  readonly maxFrames?: number;
  readonly preMarkerWindowMs?: DurationMs;
  readonly postMarkerWindowMs?: DurationMs;
}
