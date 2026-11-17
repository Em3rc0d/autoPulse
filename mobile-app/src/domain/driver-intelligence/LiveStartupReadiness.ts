/**
 * A VERIFIED read-only characterization means that standard OBD reachability
 * was observed. It is NOT proof of a complete diagnostic Check or vehicle health.
 */
export type LiveCharacterizationStatus = 'NOT_RUN' | 'VERIFIED' | 'LIMITED' | 'FAILED';

interface EcuStartupObservation {
  value: number;
  observedAt: number;
  origin: 'ECU_DIRECT' | 'DEVICE_SENSOR' | 'CALCULATED' | 'ESTIMATED';
  quality: 'VALID' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE' | 'INVALID';
}

export interface StartupEvidenceGate {
  ecuEvidenceCurrent: boolean;
  readOnlyCharacterizationVerified: boolean;
}

export function classifyLiveCharacterization(
  observations: readonly { key: string; supported: boolean }[],
): LiveCharacterizationStatus {
  return observations.some(item => item.key === 'standard_obd_reachable' && item.supported === true)
    ? 'VERIFIED'
    : 'LIMITED';
}

/** An adapter handshake is not ECU evidence. An old sample is not live connection proof. */
export function resolveStartupEvidenceGate(input: {
  rpm?: EcuStartupObservation;
  coolant?: EcuStartupObservation;
  nowMs: number;
  characterizationStatus: LiveCharacterizationStatus;
}): StartupEvidenceGate {
  const freshEcuObservation = (sample?: EcuStartupObservation): boolean =>
    Boolean(sample &&
      sample.origin === 'ECU_DIRECT' &&
      sample.quality === 'VALID' &&
      Number.isFinite(sample.value) &&
      Number.isFinite(sample.observedAt) &&
      sample.observedAt <= input.nowMs &&
      input.nowMs - sample.observedAt <= 5_000);

  return {
    ecuEvidenceCurrent: freshEcuObservation(input.rpm) || freshEcuObservation(input.coolant),
    readOnlyCharacterizationVerified: input.characterizationStatus === 'VERIFIED',
  };
}
