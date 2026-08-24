import type {
  DiagnosticConnector,
  DiagnosticExecutionStatus,
  DiagnosticRequest,
  DiagnosticResponse,
} from './DiagnosticConnector';

export interface EcuCapabilityObservation {
  ecu: string;
  request: string;
  status: DiagnosticExecutionStatus;
  expectedService?: string;
  expectedPid?: string;
  latencyMs: number;
}

export interface EcuCapabilityProfile {
  ecu: string;
  observedRequests: readonly string[];
  observedServices: readonly string[];
  observedPids: readonly string[];
  observations: readonly EcuCapabilityObservation[];
}

export interface EcuCapabilityDiscoveryResult {
  ecus: readonly EcuCapabilityProfile[];
  unattributedObservations: readonly EcuCapabilityObservation[];
}

export interface EcuCapabilityProbe {
  payload: string;
  expectedService?: string;
  expectedPid?: string;
  timeoutMs?: number;
}

export const DEFAULT_ECU_CAPABILITY_PROBES: readonly EcuCapabilityProbe[] = [
  { payload: '0100', expectedService: '41', expectedPid: '00', timeoutMs: 8000 },
  { payload: '010C', expectedService: '41', expectedPid: '0C' },
  { payload: '010D', expectedService: '41', expectedPid: '0D' },
  { payload: '0105', expectedService: '41', expectedPid: '05' },
  { payload: '0142', expectedService: '41', expectedPid: '42' },
  { payload: '03', expectedService: '43', timeoutMs: 5000 },
  { payload: '0902', expectedService: '49', expectedPid: '02', timeoutMs: 5000 },
];

const makeRequest = (probe: EcuCapabilityProbe): DiagnosticRequest => ({
  id: `ecu-discovery:${probe.payload}:${Math.random().toString(36).slice(2)}`,
  payload: probe.payload,
  kind: 'OBD_STANDARD',
  timeoutMs: probe.timeoutMs ?? 4000,
  expectedService: probe.expectedService,
  expectedPid: probe.expectedPid,
});

const unique = (values: readonly string[]) => Array.from(new Set(values));

/**
 * Evidence-only ECU capability characterization.
 * It records what each source address actually answered. It deliberately does
 * not infer module roles (engine/ABS/TPMS/etc.) from addresses alone.
 */
export async function discoverEcuCapabilities(
  connector: DiagnosticConnector,
  probes: readonly EcuCapabilityProbe[] = DEFAULT_ECU_CAPABILITY_PROBES,
): Promise<EcuCapabilityDiscoveryResult> {
  const byEcu = new Map<string, EcuCapabilityObservation[]>();
  const unattributed: EcuCapabilityObservation[] = [];

  for (const probe of probes) {
    const request = makeRequest(probe);
    const response: DiagnosticResponse = await connector.execute(request);
    if (response.status !== 'SUCCESS') continue;

    const targets = response.sourceEcus.length > 0 ? unique(response.sourceEcus) : [];
    const observationFor = (ecu: string): EcuCapabilityObservation => ({
      ecu,
      request: probe.payload,
      status: response.status,
      expectedService: probe.expectedService,
      expectedPid: probe.expectedPid,
      latencyMs: response.latencyMs,
    });

    if (targets.length === 0) {
      unattributed.push(observationFor('UNKNOWN'));
      continue;
    }

    for (const ecu of targets) {
      const list = byEcu.get(ecu) ?? [];
      list.push(observationFor(ecu));
      byEcu.set(ecu, list);
    }
  }

  const ecus = Array.from(byEcu.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ecu, observations]) => ({
      ecu,
      observedRequests: unique(observations.map(item => item.request)),
      observedServices: unique(observations.map(item => item.expectedService).filter((value): value is string => Boolean(value))),
      observedPids: unique(observations.map(item => item.expectedPid).filter((value): value is string => Boolean(value))),
      observations,
    }));

  return { ecus, unattributedObservations: unattributed };
}
