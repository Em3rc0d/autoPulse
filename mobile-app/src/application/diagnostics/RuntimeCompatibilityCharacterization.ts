import {
  characterizeDiagnosticServices,
  createCompatibilitySnapshot,
  discoverDiagnosticEnvironment,
  discoverEcuCapabilities,
  type CompatibilitySnapshot,
  type DiagnosticConnector,
  type VehicleDiagnosticIdentity,
} from '../../domain/diagnostics';

export interface RuntimeCompatibilityCharacterizationInput {
  connector: DiagnosticConnector;
  vehicle?: VehicleDiagnosticIdentity;
  capturedAt?: number;
}

/**
 * Runs read-only, evidence-first characterization against an already-connected
 * diagnostic connector. Failure of this characterization must not be confused
 * with failure of the core live acquisition path.
 */
export async function characterizeRuntimeCompatibility(
  input: RuntimeCompatibilityCharacterizationInput,
): Promise<CompatibilitySnapshot> {
  const { connector } = input;

  const environment = await discoverDiagnosticEnvironment(connector);
  const ecuCapabilities = await discoverEcuCapabilities(connector);
  const services = await characterizeDiagnosticServices(connector);
  const connectorCapabilities = await connector.discoverCapabilities();

  return createCompatibilitySnapshot({
    capturedAt: input.capturedAt,
    connector: environment.observedIdentity,
    connectorCapabilities,
    connectorHealth: connector.health(),
    vehicle: input.vehicle,
    protocol: environment.protocol,
    discoveredEcus: environment.sourceEcus,
    ecuCapabilities: ecuCapabilities.ecus,
    diagnosticServices: services.services,
    enhancedDiagnosticsAdvertised: services.enhancedDiagnosticsAdvertised,
    enhancedDiagnosticsProbed: services.enhancedDiagnosticsProbed,
    observations: [
      {
        key: 'standard_obd_reachable',
        supported: environment.standardObdReachable,
      },
      {
        key: 'unattributed_success_count',
        supported: ecuCapabilities.unattributedObservations.length > 0,
        detail: String(ecuCapabilities.unattributedObservations.length),
      },
    ],
  });
}
