import type {
  DiagnosticConnector,
  DiagnosticExecutionStatus,
  DiagnosticRequest,
  DiagnosticRequestKind,
} from './DiagnosticConnector';

export type DiagnosticServiceFamily =
  | 'CURRENT_DATA'
  | 'STORED_DTC'
  | 'PENDING_DTC'
  | 'VEHICLE_INFORMATION'
  | 'PERMANENT_DTC'
  | 'UDS_ENHANCED'
  | 'VENDOR_ENHANCED';

export interface DiagnosticServiceProbe {
  id: string;
  family: DiagnosticServiceFamily;
  payload: string;
  kind: DiagnosticRequestKind;
  expectedService?: string;
  expectedPid?: string;
  timeoutMs?: number;
}

export interface DiagnosticServiceObservation {
  probeId: string;
  family: DiagnosticServiceFamily;
  request: string;
  status: DiagnosticExecutionStatus;
  sourceEcus: readonly string[];
  diagnosticCodes: readonly string[];
  latencyMs: number;
}

export interface DiagnosticServiceAvailability {
  family: DiagnosticServiceFamily;
  observed: boolean;
  sourceEcus: readonly string[];
  diagnosticCodes: readonly string[];
  evidence: readonly DiagnosticServiceObservation[];
}

export interface DiagnosticServiceCharacterizationResult {
  services: readonly DiagnosticServiceAvailability[];
  enhancedDiagnosticsAdvertised: boolean;
  enhancedDiagnosticsProbed: boolean;
  observations: readonly DiagnosticServiceObservation[];
}

/**
 * Safe, generic, read-only OBD probes. These do not change ECU state.
 * Enhanced UDS/vendor probes are intentionally excluded: arbitrary DIDs,
 * routines or sessions must only be used when a vehicle/module profile defines
 * a known-safe contract for the target.
 */
export const SAFE_STANDARD_SERVICE_PROBES: readonly DiagnosticServiceProbe[] = [
  {
    id: 'mode01-capabilities',
    family: 'CURRENT_DATA',
    payload: '0100',
    kind: 'OBD_STANDARD',
    expectedService: '41',
    expectedPid: '00',
    timeoutMs: 8000,
  },
  {
    id: 'mode03-stored-dtc',
    family: 'STORED_DTC',
    payload: '03',
    kind: 'OBD_STANDARD',
    expectedService: '43',
    timeoutMs: 5000,
  },
  {
    id: 'mode07-pending-dtc',
    family: 'PENDING_DTC',
    payload: '07',
    kind: 'OBD_STANDARD',
    expectedService: '47',
    timeoutMs: 5000,
  },
  {
    id: 'mode09-vehicle-information',
    family: 'VEHICLE_INFORMATION',
    payload: '0900',
    kind: 'OBD_STANDARD',
    expectedService: '49',
    expectedPid: '00',
    timeoutMs: 5000,
  },
  {
    id: 'mode0a-permanent-dtc',
    family: 'PERMANENT_DTC',
    payload: '0A',
    kind: 'OBD_STANDARD',
    expectedService: '4A',
    timeoutMs: 5000,
  },
];

const makeRequest = (probe: DiagnosticServiceProbe): DiagnosticRequest => ({
  id: `service:${probe.id}:${Math.random().toString(36).slice(2)}`,
  payload: probe.payload,
  kind: probe.kind,
  timeoutMs: probe.timeoutMs ?? 4000,
  expectedService: probe.expectedService,
  expectedPid: probe.expectedPid,
});

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

export async function characterizeDiagnosticServices(
  connector: DiagnosticConnector,
  probes: readonly DiagnosticServiceProbe[] = SAFE_STANDARD_SERVICE_PROBES,
): Promise<DiagnosticServiceCharacterizationResult> {
  const capabilities = await connector.discoverCapabilities();
  const observations: DiagnosticServiceObservation[] = [];

  for (const probe of probes) {
    if (!capabilities.requestKinds.includes(probe.kind)) continue;

    const response = await connector.execute(makeRequest(probe));
    observations.push({
      probeId: probe.id,
      family: probe.family,
      request: probe.payload,
      status: response.status,
      sourceEcus: unique(response.sourceEcus),
      diagnosticCodes: unique(response.diagnosticCodes ?? []),
      latencyMs: response.latencyMs,
    });
  }

  const families = unique<DiagnosticServiceFamily>(observations.map(item => item.family));
  const services: DiagnosticServiceAvailability[] = families.map(family => {
    const evidence = observations.filter(item => item.family === family);
    const successful = evidence.filter(item => item.status === 'SUCCESS');
    return {
      family,
      observed: successful.length > 0,
      sourceEcus: unique(successful.flatMap(item => item.sourceEcus)),
      diagnosticCodes: unique(successful.flatMap(item => item.diagnosticCodes)),
      evidence,
    };
  });

  const enhancedDiagnosticsAdvertised =
    capabilities.requestKinds.includes('UDS') ||
    capabilities.requestKinds.includes('VENDOR_SPECIFIC');

  const enhancedDiagnosticsProbed = observations.some(item =>
    item.family === 'UDS_ENHANCED' || item.family === 'VENDOR_ENHANCED'
  );

  return {
    services,
    enhancedDiagnosticsAdvertised,
    enhancedDiagnosticsProbed,
    observations,
  };
}
