import type {
  DiagnosticConnectorCapabilities,
  DiagnosticConnectorHealth,
  DiagnosticConnectorIdentity,
  DiagnosticProtocol,
} from './DiagnosticConnector';
import type { EcuCapabilityProfile } from './EcuCapabilityDiscovery';
import type { DiagnosticServiceAvailability } from './DiagnosticServiceCharacterization';

export interface VehicleDiagnosticIdentity {
  vehicleId?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
}

export interface CompatibilityObservation {
  key: string;
  supported: boolean;
  detail?: string;
}

export interface CompatibilitySnapshot {
  capturedAt: number;
  connector: DiagnosticConnectorIdentity;
  connectorCapabilities: DiagnosticConnectorCapabilities;
  connectorHealth: DiagnosticConnectorHealth;
  vehicle: VehicleDiagnosticIdentity;
  protocol: DiagnosticProtocol;
  discoveredEcus: readonly string[];
  ecuCapabilities: readonly EcuCapabilityProfile[];
  diagnosticServices: readonly DiagnosticServiceAvailability[];
  enhancedDiagnosticsAdvertised: boolean;
  enhancedDiagnosticsProbed: boolean;
  observations: readonly CompatibilityObservation[];
}

export interface CompatibilitySnapshotInput {
  capturedAt?: number;
  connector: DiagnosticConnectorIdentity;
  connectorCapabilities: DiagnosticConnectorCapabilities;
  connectorHealth: DiagnosticConnectorHealth;
  vehicle?: VehicleDiagnosticIdentity;
  protocol?: DiagnosticProtocol;
  discoveredEcus?: readonly string[];
  ecuCapabilities?: readonly EcuCapabilityProfile[];
  diagnosticServices?: readonly DiagnosticServiceAvailability[];
  enhancedDiagnosticsAdvertised?: boolean;
  enhancedDiagnosticsProbed?: boolean;
  observations?: readonly CompatibilityObservation[];
}

/** Stable evidence record for one connector x vehicle characterization run. */
export function createCompatibilitySnapshot(input: CompatibilitySnapshotInput): CompatibilitySnapshot {
  const ecuCapabilities = input.ecuCapabilities ?? [];
  const discoveredEcus = [
    ...(input.discoveredEcus ?? []),
    ...ecuCapabilities.map(profile => profile.ecu),
  ];

  return {
    capturedAt: input.capturedAt ?? Date.now(),
    connector: input.connector,
    connectorCapabilities: input.connectorCapabilities,
    connectorHealth: input.connectorHealth,
    vehicle: input.vehicle ?? {},
    protocol: input.protocol ?? 'UNKNOWN',
    discoveredEcus: [...new Set(discoveredEcus)],
    ecuCapabilities,
    diagnosticServices: input.diagnosticServices ?? [],
    enhancedDiagnosticsAdvertised: input.enhancedDiagnosticsAdvertised ?? false,
    enhancedDiagnosticsProbed: input.enhancedDiagnosticsProbed ?? false,
    observations: input.observations ?? [],
  };
}
