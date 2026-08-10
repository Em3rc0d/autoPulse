import { isProductSignalSupported } from './ObdSignalRegistry';

export type MonitoringProfile = 'GENERAL' | 'OFF_ROAD' | 'PERFORMANCE' | 'FAMILY';

export interface DrivingModeDefinition {
  profile: MonitoringProfile;
  label: string;
  preferredSignals: string[];
}

export const DRIVING_MODES: Record<MonitoringProfile, DrivingModeDefinition> = {
  GENERAL: {
    profile: 'GENERAL',
    label: 'Live Data',
    preferredSignals: ['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'CONTROL_MODULE_VOLTAGE', 'ADAPTER_VOLTAGE']
  },
  OFF_ROAD: {
    profile: 'OFF_ROAD',
    label: 'Off Road',
    preferredSignals: [
      'ENGINE_COOLANT',
      'ENGINE_LOAD',
      'INTAKE_TEMP',
      'CONTROL_MODULE_VOLTAGE',
      'ADAPTER_VOLTAGE',
      'MAP',
      'ENGINE_RPM',
      'ENGINE_OIL_TEMP'
    ]
  },
  PERFORMANCE: {
    profile: 'PERFORMANCE',
    label: 'Performance',
    preferredSignals: [
      'ENGINE_RPM',
      'ENGINE_LOAD',
      'THROTTLE_POSITION',
      'MAP',
      'ENGINE_COOLANT',
      'INTAKE_TEMP',
      'TIMING_ADVANCE',
      'MAF',
      'ENGINE_OIL_TEMP',
      'VEHICLE_SPEED'
    ]
  },
  FAMILY: {
    profile: 'FAMILY',
    label: 'Family',
    preferredSignals: [
      'VEHICLE_SPEED',
      'ENGINE_RPM',
      'ENGINE_COOLANT',
      'CONTROL_MODULE_VOLTAGE',
      'ADAPTER_VOLTAGE',
      'FUEL_LEVEL',
      'ENGINE_LOAD'
    ]
  }
};

/**
 * Resolves up to maxSignals from the preferred list that are actually available in the vehicle
 * and decodable by AutoPulse.
 * @param profile The monitoring profile to evaluate.
 * @param availableSignalIds Set of signal IDs the vehicle supports.
 * @param maxSignals Number of signals to select (default 4).
 * @returns Array of selected signal IDs.
 */
export function resolveDrivingModeSignals(
  profile: MonitoringProfile,
  availableSignalIds: Set<string>,
  maxSignals: number = 4
): string[] {
  const definition = DRIVING_MODES[profile] || DRIVING_MODES.GENERAL;
  const selected: string[] = [];

  // 1. Try preferred signals for this profile
  for (const signalId of definition.preferredSignals) {
    if ((availableSignalIds.has(signalId) || signalId === 'ADAPTER_VOLTAGE') && isProductSignalSupported(signalId)) {
      if (!selected.includes(signalId)) {
        selected.push(signalId);
        if (selected.length >= maxSignals) {
          return selected;
        }
      }
    }
  }

  // 2. Fallback to any decodable signal supported by the vehicle in OBD_SIGNAL_REGISTRY
  if (selected.length < maxSignals) {
    for (const signalId of availableSignalIds) {
      if (isProductSignalSupported(signalId) && !selected.includes(signalId)) {
        selected.push(signalId);
        if (selected.length >= maxSignals) {
          break;
        }
      }
    }
  }

  return selected;
}
