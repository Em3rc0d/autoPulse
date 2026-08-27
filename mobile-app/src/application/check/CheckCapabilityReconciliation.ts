import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import {
  AutoPulseCheckCapabilityFacts,
  CapabilitySupport,
} from './AutoPulseCheckPlan';

export interface CheckCapabilityDiscoveryObservation {
  readonly initializationSuccessful: boolean;
  readonly protocol?: string | null;
  readonly supportedPids: readonly string[];
  readonly directlyObservedPids?: readonly string[];
  readonly adapterIdentity?: Readonly<Record<string, string>>;
  readonly failureReason?: string;
}

export type CheckCapabilityPatch = Partial<AutoPulseCheckCapabilityFacts>;

function mergeSupport(
  current: CapabilitySupport,
  incoming: CapabilitySupport | undefined,
): CapabilitySupport {
  if (!incoming) return current;
  if (current === 'SUPPORTED' && incoming === 'UNKNOWN') return current;
  if (current === 'UNSUPPORTED' && incoming === 'UNKNOWN') return current;
  return incoming;
}

export function mergeCheckCapabilities(
  current: AutoPulseCheckCapabilityFacts,
  patch: CheckCapabilityPatch,
): AutoPulseCheckCapabilityFacts {
  const availableSignals = patch.availableSignals
    ? Array.from(new Set([...(current.availableSignals ?? []), ...patch.availableSignals].filter(Boolean)))
    : current.availableSignals;

  return {
    obd: mergeSupport(current.obd, patch.obd),
    dtcRead: mergeSupport(current.dtcRead, patch.dtcRead),
    readiness: mergeSupport(current.readiness, patch.readiness),
    freezeFrame: mergeSupport(current.freezeFrame, patch.freezeFrame),
    liveTelemetry: mergeSupport(current.liveTelemetry, patch.liveTelemetry),
    availableSignals,
  };
}

export function capabilityPatchFromDiscovery(
  observation: CheckCapabilityDiscoveryObservation,
): CheckCapabilityPatch {
  if (!observation.initializationSuccessful) return {};
  return {
    obd: 'SUPPORTED',
    liveTelemetry: observation.supportedPids.length > 0 ? 'SUPPORTED' : 'UNKNOWN',
    availableSignals: observation.supportedPids,
  };
}

export function capabilityPatchFromDiagnosticEvidence(
  evidence: EvidenceItem,
): CheckCapabilityPatch {
  const status = evidence.metadata?.executionStatus as string | undefined;

  if (evidence.type === 'OBD_STORED_DTC_SCAN') {
    if (status === 'SUCCESS' || status === 'NO_DATA') return { dtcRead: 'SUPPORTED' };
    if (status === 'UNSUPPORTED') return { dtcRead: 'UNSUPPORTED' };
    return {};
  }

  if (evidence.type === 'OBD_MONITOR_STATUS_PID01') {
    if (status === 'SUCCESS' && evidence.metadata?.monitorStatus) return { readiness: 'SUPPORTED' };
    if (status === 'UNSUPPORTED') return { readiness: 'UNSUPPORTED' };
    return {};
  }

  if (evidence.type === 'OBD_FREEZE_FRAME_TRIGGER') {
    if (status === 'SUCCESS' && evidence.metadata?.freezeFrameTrigger) return { freezeFrame: 'SUPPORTED' };
    if (status === 'UNSUPPORTED') return { freezeFrame: 'UNSUPPORTED' };
    return {};
  }

  return {};
}
