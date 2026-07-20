import { TelemetryPreset } from '../models/enums';
import { TelemetrySignalDefinition } from '../models/telemetrySignalDefinition';
import { CapabilitySnapshot } from '../../acquisition/models/capabilitySnapshot';

export function resolveAvailableSignals(
  preset: TelemetryPreset,
  availableSignals: readonly TelemetrySignalDefinition[],
  capabilitySnapshot?: CapabilitySnapshot
): readonly TelemetrySignalDefinition[] {
  // A signal is included if it belongs to the preset.
  // We do NOT remove it if it's not supported; it will just be marked UNAVAILABLE in samples.
  return availableSignals.filter(signal => signal.recommendedPresets.includes(preset));
}
