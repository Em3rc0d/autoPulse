import type {
  DiagnosticConnector,
  DiagnosticRequest,
  DiagnosticRequestKind,
  DiagnosticResponse,
} from './DiagnosticConnector';

export interface EnhancedDiagnosticProbe {
  id: string;
  kind: Extract<DiagnosticRequestKind, 'UDS' | 'VENDOR_SPECIFIC'>;
  payload: string;
  timeoutMs?: number;
  expectedService?: string;
  expectedPid?: string;
  access: 'READ_ONLY';
}

export interface EnhancedDiagnosticProfileMatch {
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  protocol?: string;
  moduleRole?: string;
}

export interface EnhancedDiagnosticProfile {
  id: string;
  version: number;
  match: EnhancedDiagnosticProfileMatch;
  probes: readonly EnhancedDiagnosticProbe[];
}

export interface EnhancedDiagnosticObservation {
  profileId: string;
  probeId: string;
  status: DiagnosticResponse['status'];
  sourceEcus: readonly string[];
  latencyMs: number;
}

export interface EnhancedDiagnosticRunResult {
  profileId: string;
  executed: boolean;
  reason?: 'NO_SUPPORTED_REQUEST_KIND' | 'NO_PROBES';
  observations: readonly EnhancedDiagnosticObservation[];
}

const requestFromProbe = (profileId: string, probe: EnhancedDiagnosticProbe): DiagnosticRequest => ({
  id: `enhanced:${profileId}:${probe.id}:${Math.random().toString(36).slice(2)}`,
  payload: probe.payload,
  kind: probe.kind,
  timeoutMs: probe.timeoutMs ?? 4000,
  expectedService: probe.expectedService,
  expectedPid: probe.expectedPid,
});

/**
 * Executes enhanced diagnostics only from an explicit, read-only profile.
 * There is intentionally no generic enhanced probe set. AutoPulse must know
 * which vehicle/module profile authorized the request before sending UDS or
 * vendor-specific commands.
 */
export async function runEnhancedDiagnosticProfile(
  connector: DiagnosticConnector,
  profile: EnhancedDiagnosticProfile,
): Promise<EnhancedDiagnosticRunResult> {
  const capabilities = await connector.discoverCapabilities();
  if (profile.probes.length === 0) {
    return { profileId: profile.id, executed: false, reason: 'NO_PROBES', observations: [] };
  }

  const executable = profile.probes.filter(probe =>
    probe.access === 'READ_ONLY' && capabilities.requestKinds.includes(probe.kind)
  );

  if (executable.length === 0) {
    return {
      profileId: profile.id,
      executed: false,
      reason: 'NO_SUPPORTED_REQUEST_KIND',
      observations: [],
    };
  }

  const observations: EnhancedDiagnosticObservation[] = [];
  for (const probe of executable) {
    const response = await connector.execute(requestFromProbe(profile.id, probe));
    observations.push({
      profileId: profile.id,
      probeId: probe.id,
      status: response.status,
      sourceEcus: Array.from(new Set(response.sourceEcus)),
      latencyMs: response.latencyMs,
    });
  }

  return { profileId: profile.id, executed: true, observations };
}
