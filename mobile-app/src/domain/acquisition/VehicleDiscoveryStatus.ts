import { VehicleParameterEvidence } from './VehicleParameterEvidence';

export type VehicleDiscoveryStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface DiscoveryEcuEvidence {
  readonly address: number;
}

export interface DiscoveryParameterEvidence {
  readonly evidence: VehicleParameterEvidence;
}

export function deriveVehicleDiscoveryStatus(
  ecus: readonly DiscoveryEcuEvidence[],
  parameters: readonly DiscoveryParameterEvidence[]
): VehicleDiscoveryStatus {
  const hasUsableVehicleEvidence = parameters.some(parameter =>
    parameter.evidence.capabilityAdvertised === 'ADVERTISED' ||
    parameter.evidence.probeResult === 'SUCCESS'
  );

  if (!hasUsableVehicleEvidence) return 'FAILED';

  const hasUnknownSource = ecus.length === 0 || ecus.some(ecu => ecu.address < 0);
  const hasUndefinedParameter = parameters.some(
    parameter => parameter.evidence.standardDefinition === 'UNDEFINED'
  );

  return hasUnknownSource || hasUndefinedParameter ? 'PARTIAL' : 'COMPLETED';
}
