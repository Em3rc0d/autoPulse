import type { AvailableSignal, DrivingMode } from './models';

export type DecisionDimensionCoverage = 'COVERED' | 'PARTIAL' | 'UNKNOWN';

export interface ModeDecisionDimensionDefinition {
  id: string;
  label: string;
  evidenceSignals: readonly string[];
  minimumSignals: number;
}

export interface ResolvedModeDecisionDimension extends ModeDecisionDimensionDefinition {
  coverage: DecisionDimensionCoverage;
  availableEvidence: AvailableSignal[];
}

const DIMENSIONS: Record<DrivingMode, readonly ModeDecisionDimensionDefinition[]> = {
  ESSENTIAL: [
    { id: 'ENGINE_STATE', label: 'Engine', evidenceSignals: ['ENGINE_RPM', 'ENGINE_COOLANT', 'ENGINE_LOAD'], minimumSignals: 1 },
    { id: 'MOTION', label: 'Motion', evidenceSignals: ['VEHICLE_SPEED'], minimumSignals: 1 },
    { id: 'ELECTRICAL', label: 'Electrical', evidenceSignals: ['CONTROL_VOLTAGE'], minimumSignals: 1 },
  ],
  FAMILY: [
    { id: 'ENGINE_HEALTH', label: 'Engine health', evidenceSignals: ['ENGINE_COOLANT', 'ENGINE_RPM', 'ENGINE_LOAD'], minimumSignals: 1 },
    { id: 'DRIVING_STATE', label: 'Driving state', evidenceSignals: ['VEHICLE_SPEED', 'THROTTLE_POSITION'], minimumSignals: 1 },
    { id: 'ELECTRICAL', label: 'Electrical', evidenceSignals: ['CONTROL_VOLTAGE'], minimumSignals: 1 },
    { id: 'FUEL', label: 'Fuel', evidenceSignals: ['FUEL_LEVEL'], minimumSignals: 1 },
  ],
  PERFORMANCE: [
    { id: 'ENGINE_STATE', label: 'Engine state', evidenceSignals: ['ENGINE_RPM', 'ENGINE_LOAD'], minimumSignals: 1 },
    { id: 'THERMAL_STATE', label: 'Thermal state', evidenceSignals: ['ENGINE_COOLANT', 'OIL_TEMP', 'INTAKE_AIR_TEMP'], minimumSignals: 1 },
    { id: 'POWER_DEMAND', label: 'Power demand', evidenceSignals: ['THROTTLE_POSITION', 'ENGINE_LOAD', 'ACTUAL_ENGINE_TORQUE'], minimumSignals: 1 },
    { id: 'AIRFLOW', label: 'Air / boost', evidenceSignals: ['MAP', 'MAF', 'INTAKE_AIR_TEMP'], minimumSignals: 1 },
    { id: 'ELECTRICAL', label: 'Electrical', evidenceSignals: ['CONTROL_VOLTAGE'], minimumSignals: 1 },
  ],
  OFF_ROAD: [
    { id: 'ENGINE_STRESS', label: 'Engine', evidenceSignals: ['ENGINE_COOLANT', 'ENGINE_LOAD', 'ENGINE_RPM'], minimumSignals: 1 },
    { id: 'INCLINE', label: 'Incline', evidenceSignals: ['PITCH'], minimumSignals: 1 },
    { id: 'ATTITUDE', label: 'Vehicle attitude', evidenceSignals: ['PITCH', 'ROLL'], minimumSignals: 1 },
    { id: 'ALTITUDE', label: 'Altitude', evidenceSignals: ['ALTITUDE'], minimumSignals: 1 },
    { id: 'HEADING', label: 'Heading', evidenceSignals: ['HEADING'], minimumSignals: 1 },
    { id: 'ELECTRICAL', label: 'Electrical', evidenceSignals: ['CONTROL_VOLTAGE'], minimumSignals: 1 },
  ],
  DIAGNOSTIC: [
    { id: 'COMBUSTION', label: 'Combustion', evidenceSignals: ['STFT_B1', 'LTFT_B1', 'O2', 'LAMBDA'], minimumSignals: 1 },
    { id: 'AIR_METERING', label: 'Air metering', evidenceSignals: ['MAP', 'MAF', 'INTAKE_AIR_TEMP'], minimumSignals: 1 },
    { id: 'ENGINE_STATE', label: 'Engine state', evidenceSignals: ['ENGINE_RPM', 'ENGINE_COOLANT'], minimumSignals: 1 },
    { id: 'ELECTRICAL', label: 'Electrical', evidenceSignals: ['CONTROL_VOLTAGE', 'ADAPTER_VOLTAGE'], minimumSignals: 1 },
  ],
};

const usable = (signal: AvailableSignal) => signal.quality === 'VALID' || signal.quality === 'DEGRADED';

export function resolveModeDecisionDimensions(
  mode: DrivingMode,
  availableSignals: readonly AvailableSignal[],
): ResolvedModeDecisionDimension[] {
  const byId = new Map(availableSignals.filter(usable).map(signal => [signal.signalId, signal]));

  return DIMENSIONS[mode].map(definition => {
    const availableEvidence = definition.evidenceSignals
      .map(signalId => byId.get(signalId))
      .filter((signal): signal is AvailableSignal => Boolean(signal));

    const coverage: DecisionDimensionCoverage = availableEvidence.length === 0
      ? 'UNKNOWN'
      : availableEvidence.length >= definition.evidenceSignals.length
        ? 'COVERED'
        : availableEvidence.length >= definition.minimumSignals
          ? 'PARTIAL'
          : 'UNKNOWN';

    return { ...definition, coverage, availableEvidence };
  });
}

export function getModeDecisionDimensions(mode: DrivingMode): readonly ModeDecisionDimensionDefinition[] {
  return DIMENSIONS[mode];
}
