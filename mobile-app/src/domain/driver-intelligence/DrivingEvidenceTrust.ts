import type { SignalCalibrationStatus } from '../telemetry/SignalAdvisory';
import type { SignalOrigin, SignalQuality } from './models';

export type EvidenceState =
  | 'OBSERVED'
  | 'UNAVAILABLE'
  | 'STALE'
  | 'INVALID'
  | 'UNTRUSTED'
  | 'UNSUPPORTED'
  | 'NOT_OBSERVED';

export type TrustPurpose = 'PRESENTABLE' | 'DECISIONABLE' | 'ALERTABLE';
export type MountContinuity = 'VALID' | 'UNKNOWN' | 'INVALID';

export interface DrivingEvidenceObservation {
  signalId: string;
  value: number;
  unit?: string;
  quality: SignalQuality;
  origin: SignalOrigin;
  observedAt: number;
  calibration?: SignalCalibrationStatus;
  mountContinuity?: MountContinuity;
}

export interface EvidenceTrustPolicy {
  dynamicFreshnessMs: number;
  slowFreshnessMs: number;
}

export const DEFAULT_EVIDENCE_TRUST_POLICY: EvidenceTrustPolicy = {
  dynamicFreshnessMs: 5_000,
  slowFreshnessMs: 15_000,
};

const SLOW_SIGNALS = new Set(['ALTITUDE']);
const PRESENTATION_ONLY_DEVICE_SIGNALS = new Set(['PHONE_PITCH', 'PHONE_ROLL', 'HEADING']);

export function evidenceState(
  observation: DrivingEvidenceObservation | undefined,
  nowMs: number,
  policy: EvidenceTrustPolicy = DEFAULT_EVIDENCE_TRUST_POLICY,
): EvidenceState {
  if (!observation) return 'NOT_OBSERVED';
  if (observation.quality === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (observation.quality === 'STALE') return 'STALE';
  if (observation.quality === 'INVALID') return 'INVALID';
  if (!Number.isFinite(observation.value)) return 'INVALID';

  const freshnessMs = SLOW_SIGNALS.has(observation.signalId)
    ? policy.slowFreshnessMs
    : policy.dynamicFreshnessMs;
  if (nowMs - observation.observedAt > freshnessMs) return 'STALE';
  return 'OBSERVED';
}

export function isTrustedFor(
  observation: DrivingEvidenceObservation | undefined,
  purpose: TrustPurpose,
  nowMs: number,
  policy: EvidenceTrustPolicy = DEFAULT_EVIDENCE_TRUST_POLICY,
): boolean {
  if (!observation || evidenceState(observation, nowMs, policy) !== 'OBSERVED') return false;

  if (purpose === 'PRESENTABLE') {
    return observation.quality === 'VALID' || observation.quality === 'DEGRADED';
  }

  if (observation.quality !== 'VALID') return false;

  // Raw phone attitude and device heading may be displayed, but they are not vehicle-state decisions.
  if (PRESENTATION_ONLY_DEVICE_SIGNALS.has(observation.signalId) && observation.origin === 'DEVICE_SENSOR') {
    return false;
  }

  if (observation.signalId === 'PITCH' || observation.signalId === 'ROLL') {
    const vehicleCalibrated = observation.calibration === 'VEHICLE_CALIBRATED';
    const mountStable = observation.mountContinuity === 'VALID';
    if (!vehicleCalibrated || !mountStable) return false;

    // Inclination safety alerts remain disabled until a vehicle/context policy is validated.
    if (purpose === 'ALERTABLE') return false;
  }

  if (purpose === 'ALERTABLE') {
    // Only explicitly alert-capable evidence is admitted here. Current thermal alerting is
    // evaluated separately with its advisory policy; generic values never self-promote.
    return observation.signalId === 'ENGINE_COOLANT';
  }

  return true;
}
