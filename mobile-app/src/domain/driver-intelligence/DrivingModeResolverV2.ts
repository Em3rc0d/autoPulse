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
  evidenceByDimension: Partial<Record<DrivingDimension, ResolvedDrivingMetric>>;
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
  slots: readonly DrivingDimension[];
  readyDimensions: readonly DrivingDimension[];
}

const MODES: Record<DrivingMode, ModeDefinition> = {
  ESSENTIAL: {
    stateFirst: false,
    slots: ['THERMAL', 'ENGINE_ACTIVITY', 'MOTION', 'ELECTRICAL'],
    readyDimensions: ['THERMAL', 'ENGINE_ACTIVITY', 'MOTION'],
  },
  FAMILY: {
    stateFirst: true,
    slots: ['THERMAL', 'ELECTRICAL', 'MOTION', 'ENGINE_ACTIVITY'],
    readyDimensions: ['THERMAL', 'ELECTRICAL', 'MOTION'],
  },
  PERFORMANCE: {
    stateFirst: false,
    slots: ['ENGINE_ACTIVITY', 'POWER_DEMAND', 'THERMAL', 'MOTION'],
    readyDimensions: ['ENGINE_ACTIVITY', 'POWER_DEMAND', 'THERMAL'],
  },
  OFF_ROAD: {
    stateFirst: false,
    slots: ['VEHICLE_ATTITUDE', 'HEADING', 'ALTITUDE', 'MOTION', 'THERMAL'],
    readyDimensions: ['VEHICLE_ATTITUDE', 'MOTION'],
  },
  DIAGNOSTIC: {
    stateFirst: true,
    slots: ['ELECTRICAL', 'THERMAL', 'ENGINE_ACTIVITY', 'MOTION'],
    readyDimensions: ['ELECTRICAL', 'THERMAL', 'ENGINE_ACTIVITY'],
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

function readyContractSatisfied(mode: DrivingMode, metrics: readonly ResolvedDrivingMetric[]): boolean {
  return MODES[mode].readyDimensions.every(dimension =>
    metrics.some(metric => metric.dimension === dimension && metric.decisionable && metric.preferred),
  );
}

function collectDimensionEvidence(
  observations: Readonly<Record<string, DrivingEvidenceObservation>>,
  nowMs: number,
): Partial<Record<DrivingDimension, ResolvedDrivingMetric>> {
  const result: Partial<Record<DrivingDimension, ResolvedDrivingMetric>> = {};
  (Object.keys(DIMENSIONS) as DrivingDimension[]).forEach(dimension => {
    const metric = resolveDimension(dimension, observations, new Set<string>(), nowMs);
    if (metric) result[dimension] = metric;
  });
  return result;
}

export function resolveDrivingModePresentation(
  mode: DrivingMode,
  observations: Readonly<Record<string, DrivingEvidenceObservation>>,
  nowMs: number,
): DrivingModePresentation {
  const definition = MODES[mode];
  const usedSignals = new Set<string>();
  const metrics: ResolvedDrivingMetric[] = [];
  const evidenceByDimension = collectDimensionEvidence(observations, nowMs);

  for (const dimension of definition.slots) {
    const metric = resolveDimension(dimension, observations, usedSignals, nowMs);
    if (!metric) continue;
    metrics.push(metric);
    usedSignals.add(metric.signalId);
    if (metrics.length === 3) break;
  }

  if (metrics.length === 0) {
    return { mode, readiness: 'UNAVAILABLE', stateFirst: definition.stateFirst, evidenceByDimension };
  }

  const readiness: ModeReadiness = readyContractSatisfied(mode, metrics)
    ? 'READY'
    : metrics.length >= 2
      ? 'ADAPTIVE'
      : 'LIMITED';

  return {
    mode,
    readiness,
    stateFirst: definition.stateFirst,
    primary: metrics[0],
    secondaryA: metrics[1],
    secondaryB: metrics[2],
    evidenceByDimension,
  };
}
