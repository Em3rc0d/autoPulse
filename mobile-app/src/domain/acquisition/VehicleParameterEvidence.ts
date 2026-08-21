export type StandardDefinitionTruth = 'DEFINED' | 'UNDEFINED';
export type CapabilityAdvertisedTruth = 'ADVERTISED' | 'NOT_ADVERTISED' | 'UNKNOWN';
export type ProbeResultTruth =
  | 'SUCCESS'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'ELM_ERROR'
  | 'INVALID_RESPONSE'
  | 'NOT_PROBED'
  | 'UNKNOWN';
export type LiveObservationTruth = 'OBSERVED' | 'NOT_OBSERVED';

export interface VehicleParameterEvidence {
  readonly standardDefinition: StandardDefinitionTruth;
  readonly capabilityAdvertised: CapabilityAdvertisedTruth;
  readonly probeResult: ProbeResultTruth;
  readonly liveObservation: LiveObservationTruth;
}

export function initializationEvidence(input: {
  definitionExists: boolean;
  advertised: boolean | null;
  probeResult?: ProbeResultTruth;
}): VehicleParameterEvidence {
  return {
    standardDefinition: input.definitionExists ? 'DEFINED' : 'UNDEFINED',
    capabilityAdvertised:
      input.advertised === null
        ? 'UNKNOWN'
        : input.advertised
          ? 'ADVERTISED'
          : 'NOT_ADVERTISED',
    probeResult: input.probeResult ?? 'NOT_PROBED',
    liveObservation: 'NOT_OBSERVED'
  };
}
