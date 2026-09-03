import type { DrivingMode } from './models';
import {
  isTrustedFor,
  type DrivingEvidenceObservation,
} from './DrivingEvidenceTrust';

export type DrivingDimension =
  | 'THERMAL'
  | 'ENGINE_ACTIVITY'
  | 'MOTION'
  | 'POWER_DEMAND'
  | 'ELECTRICAL'
  | 'VEHICLE_ATTITUDE'
  | 'HEADING'
  | 'ALTITUDE'
  | 'DIAGNOSTIC_HEALTH';

export type ModeReadiness = 'READY' | 'ADAPTIVE' | 'LIMITED' | 'UNAVAILABLE';

export interface ResolvedDrivingMetric {
  dimension: DrivingDimension;
  signalId: string;
  label: string;
  value: number;
  unit?: string;
  preferred: boolean;
  decisionable: boolean;
}

export interface DrivingModePresentation {
  mode: DrivingMode;
  readiness: ModeReadiness;
  stateFirst: boolean;
  primary?: ResolvedDrivingMetric;
  secondaryA?: ResolvedDrivingMetric;
  secondaryB?: ResolvedDrivingMetric;
}

interface Candidate {
  signalId: string;
  label: string;
}

interface DimensionDefinition {
  id: DrivingDimension;
  candidates: readonly Candidate[];
  requireDecisionable?: boolean;
}

const DIMENSIONS: Record<DrivingDimension, DimensionDefinition> = {
  THERMAL: {
    id: 'THERMAL',
    candidates: [
      { signalId: 'ENGINE_COOLANT', label: 'ENGINE TEMP' },
      { signalId: 'OIL_TEMP', label: 'OIL TEMP' },
      { signalId: 'TRANSMISSION_TEMP', label: 'TRANS TEMP' },
    ],
  },
  ENGINE_ACTIVITY: {
    id: 'ENGINE_ACTIVITY',
    candidates: [{ signalId: 'ENGINE_RPM', label: 'RPM' }],
  },
  MOTION: {
    id: 'MOTION',
    candidates: [{ signalId: 'VEHICLE_SPEED', label: 'SPEED' }],
  },
  POWER_DEMAND: {
    id: 'POWER_DEMAND',
    candidates: [
      { signalId: 'ENGINE_LOAD', label: 'ENGINE LOAD' },
      { signalId: 'THROTTLE_POSITION', label: 'THROTTLE' },
    ],
  },
  ELECTRICAL: {
    id: 'ELECTRICAL',
    candidates: [
      { signalId: 'CONTROL_VOLTAGE', label: 'ECU VOLTAGE' },
      { signalId: 'ADAPTER_VOLTAGE', label: 'ADAPTER VOLTAGE' },
    ],
  },
  VEHICLE_ATTITUDE: {
    id: 'VEHICLE_ATTITUDE',
    candidates: [
      { signalId: 'PITCH', label: 'PITCH' },
      { signalId: 'ROLL', label: 'ROLL' },
    ],
    requireDecisionable: true,
  },
  HEADING: {
    id: 'HEADING',
    candidates: [{ signalId: 'HEADING', label: 'PHONE HEADING' }],
  },
  ALTITUDE: {
    id: 'ALTITUDE',
    candidates: [{ signalId: 'ALTITUDE', label: 'ALTITUDE' }],
  },
  DIAGNOSTIC_HEALTH: {
    id: 'DIAGNOSTIC_HEALTH',
    candidates: [],
  },
};

interface ModeDefinition {
  stateFirst: boolean;
  fundamental: readonly DrivingDimension[];
  slots: readonly DrivingDimension[];
}

const MODES: Record<DrivingMode, ModeDefinition> = {
  ESSENTIAL: {
    stateFirst: false,
    fundamental: ['THERMAL'],
    slots: ['THERMAL', 'ENGINE_ACTIVITY', 'MOTION', 'ELECTRICAL'],
  },
  FAMILY: {
    stateFirst: true,
    fundamental: ['THERMAL'],
    slots: ['THERMAL', 'ELECTRICAL', 'MOTION', 'ENGINE_ACTIVITY'],
  },
  PERFORMANCE: {
    stateFirst: false,
    fundamental: ['ENGINE_ACTIVITY'],
    slots: ['ENGINE_ACTIVITY', 'POWER_DEMAND', 'THERMAL', 'MOTION'],
  },
  OFF_ROAD: {
    stateFirst: false,
    fundamental: ['VEHICLE_ATTITUDE'],
    slots: ['VEHICLE_ATTITUDE', 'HEADING', 'ALTITUDE', 'MOTION', 'THERMAL'],
  },
  DIAGNOSTIC: {
    stateFirst: true,
    fundamental: ['DIAGNOSTIC_HEALTH'],
    slots: ['ELECTRICAL', 'THERMAL', 'ENGINE_ACTIVITY', 'MOTION'],
  },
};

function resolveDimension(
  dimension: DrivingDimension,
  observations: Readonly<Record<string, DrivingEvidenceObservation>>,
  usedSignals: Set<string>,
  nowMs: number,
): ResolvedDrivingMetric | undefined {
  const definition = DIMENSIONS[dimension];
  for (let index = 0; index < definition.candidates.length; index += 1) {
    const candidate = definition.candidates[index];
    if (usedSignals.has(candidate.signalId)) continue;
    const observation = observations[candidate.signalId];
    const presentable = isTrustedFor(observation, 'PRESENTABLE', nowMs);
    const decisionable = isTrustedFor(observation, 'DECISIONABLE', nowMs);
    if (!presentable || (definition.requireDecisionable && !decisionable)) continue;

    return {
      dimension,
      signalId: candidate.signalId,
      label: candidate.label,
      value: observation.value,
      unit: observation.unit,
      preferred: index === 0,
      decisionable,
    };
  }
  return undefined;
}

function fundamentalResolved(
  mode: DrivingMode,
  metrics: readonly ResolvedDrivingMetric[],
): boolean {
  const definition = MODES[mode];
  if (mode === 'DIAGNOSTIC') return true; // health state is resolved by the alert/diagnostic layer.
  return definition.fundamental.some(dimension =>
    metrics.some(metric => metric.dimension === dimension && metric.decisionable),
  );
}

export function resolveDrivingModePresentation(
  mode: DrivingMode,
  observations: Readonly<Record<string, DrivingEvidenceObservation>>,
  nowMs: number,
): DrivingModePresentation {
  const definition = MODES[mode];
  const usedSignals = new Set<string>();
  const metrics: ResolvedDrivingMetric[] = [];

  for (const dimension of definition.slots) {
    const metric = resolveDimension(dimension, observations, usedSignals, nowMs);
    if (!metric) continue;
    metrics.push(metric);
    usedSignals.add(metric.signalId);
    if (metrics.length === 3) break;
  }

  if (metrics.length === 0 && mode !== 'DIAGNOSTIC') {
    return { mode, readiness: 'UNAVAILABLE', stateFirst: definition.stateFirst };
  }

  const fundamental = fundamentalResolved(mode, metrics);
  const allSelectedPreferred = metrics.every(metric => metric.preferred);
  const readiness: ModeReadiness = !fundamental
    ? 'LIMITED'
    : allSelectedPreferred && metrics.length >= 2
      ? 'READY'
      : 'ADAPTIVE';

  return {
    mode,
    readiness,
    stateFirst: definition.stateFirst,
    primary: metrics[0],
    secondaryA: metrics[1],
    secondaryB: metrics[2],
  };
}
