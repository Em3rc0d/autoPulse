import type { AvailableSignal, DrivingMode } from './models';

const MODE_SIGNAL_PREFERENCES: Record<DrivingMode, readonly string[]> = {
  ESSENTIAL: ['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'CONTROL_VOLTAGE', 'ENGINE_LOAD', 'THROTTLE_POSITION'],
  FAMILY: ['VEHICLE_SPEED', 'ENGINE_COOLANT', 'CONTROL_VOLTAGE', 'ENGINE_LOAD', 'FUEL_LEVEL', 'ENGINE_RPM'],
  PERFORMANCE: ['ENGINE_RPM', 'THROTTLE_POSITION', 'ENGINE_LOAD', 'ENGINE_COOLANT', 'INTAKE_AIR_TEMP', 'MAP', 'MAF', 'OIL_TEMP', 'ACTUAL_ENGINE_TORQUE'],
  OFF_ROAD: ['ENGINE_COOLANT', 'ENGINE_LOAD', 'ENGINE_RPM', 'CONTROL_VOLTAGE', 'MAP', 'VEHICLE_SPEED', 'ALTITUDE', 'PITCH', 'ROLL', 'HEADING'],
  DIAGNOSTIC: ['STFT_B1', 'LTFT_B1', 'MAP', 'MAF', 'ENGINE_RPM', 'ENGINE_COOLANT', 'INTAKE_AIR_TEMP', 'CONTROL_VOLTAGE', 'O2', 'LAMBDA'],
};

const usable = (signal: AvailableSignal) =>
  signal.quality === 'VALID' || signal.quality === 'DEGRADED';

export interface ResolvedDrivingMode {
  mode: DrivingMode;
  selectedSignals: AvailableSignal[];
  missingPreferredSignals: string[];
  degraded: boolean;
}

export function resolveDrivingMode(
  mode: DrivingMode,
  availableSignals: readonly AvailableSignal[],
): ResolvedDrivingMode {
  const byId = new Map(availableSignals.map(signal => [signal.signalId, signal]));
  const preferences = MODE_SIGNAL_PREFERENCES[mode];

  const selectedSignals = preferences
    .map(signalId => byId.get(signalId))
    .filter((signal): signal is AvailableSignal => Boolean(signal && usable(signal)));

  const missingPreferredSignals = preferences.filter(signalId => {
    const signal = byId.get(signalId);
    return !signal || !usable(signal);
  });

  return {
    mode,
    selectedSignals,
    missingPreferredSignals,
    degraded: missingPreferredSignals.length > 0,
  };
}

export function getModeSignalPreferences(mode: DrivingMode): readonly string[] {
  return MODE_SIGNAL_PREFERENCES[mode];
}
