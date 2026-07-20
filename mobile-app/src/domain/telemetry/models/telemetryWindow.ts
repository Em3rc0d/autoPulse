import { LiveSessionId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { TelemetryFrame } from './telemetryFrame';
import { TelemetryMarker } from './telemetryMarker';
import { TelemetrySignalDefinition } from './telemetrySignalDefinition';
import { CapabilitySnapshot } from '../../acquisition/models/capabilitySnapshot';
import { ConnectionQualitySummary } from '../../acquisition/models/connectionQuality';

export interface TelemetryWindow {
  readonly sessionId: LiveSessionId;
  readonly startedAt: UtcIsoTimestamp;
  readonly endedAt: UtcIsoTimestamp;
  readonly frames: readonly TelemetryFrame[];
  readonly markers: readonly TelemetryMarker[];
  readonly signalDefinitions: readonly TelemetrySignalDefinition[];
  readonly capabilitySnapshot?: CapabilitySnapshot;
  readonly qualitySummary?: ConnectionQualitySummary;
}
