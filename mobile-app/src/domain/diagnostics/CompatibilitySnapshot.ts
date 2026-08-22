import type {
  DiagnosticConnectorCapabilities,
  DiagnosticConnectorHealth,
  DiagnosticConnectorIdentity,
  DiagnosticProtocol,
} from './DiagnosticConnector';

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
  observations?: readonly CompatibilityObservation[];
}

/** Stable evidence record for one connector x vehicle characterization run. */
export function createCompatibilitySnapshot(input: CompatibilitySnapshotInput): CompatibilitySnapshot {
  return {
    capturedAt: input.capturedAt ?? Date.now(),
    connector: input.connector,
    connectorCapabilities: input.connectorCapabilities,
    connectorHealth: input.connectorHealth,
    vehicle: input.vehicle ?? {},
    protocol: input.protocol ?? 'UNKNOWN',
    discoveredEcus: [...new Set(input.discoveredEcus ?? [])],
    observations: input.observations ?? [],
  };
}
