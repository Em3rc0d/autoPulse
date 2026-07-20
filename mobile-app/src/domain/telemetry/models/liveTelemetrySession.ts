import { LiveSessionId, VehicleId, TechnicianId, SignalId, MarkerId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { LiveSessionState, TelemetryPreset } from './enums';
import { CapabilitySnapshot } from '../../acquisition/models/capabilitySnapshot';
import { TelemetryRecordingPolicy } from './telemetryRecordingPolicy';

export interface LiveTelemetrySession {
  readonly id: LiveSessionId;
  readonly vehicleId: VehicleId;
  readonly operatorId: TechnicianId;
  readonly state: LiveSessionState;
  readonly preset: TelemetryPreset;
  readonly activeSignalIds: readonly SignalId[];
  readonly capabilitySnapshot?: CapabilitySnapshot;
  readonly recordingPolicy: TelemetryRecordingPolicy;
  readonly startedAt: UtcIsoTimestamp;
  readonly endedAt?: UtcIsoTimestamp;
  readonly interruptionReason?: string;
  readonly markerIds: readonly MarkerId[];
}
