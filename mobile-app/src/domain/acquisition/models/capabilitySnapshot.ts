import { SignalId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';

export type CapabilitySupportState =
  | 'SUPPORTED'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN';

export type CapabilityEvidenceOrigin =
  | 'BITMAP'
  | 'DIRECT_OBSERVATION'
  | 'PROBE'
  | 'REPLAY_FIXTURE';

export type CapabilityDiscoveryOutcome =
  | 'SUCCESS'
  | 'NOT_ATTEMPTED'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'NO_RESPONSE'
  | 'NEGATIVE_RESPONSE'
  | 'INVALID_RESPONSE'
  | 'TRANSPORT_ERROR';

export interface CapabilitySignal {
  readonly id: SignalId;
  readonly supportState: CapabilitySupportState;
  readonly evidenceOrigin: CapabilityEvidenceOrigin;
  readonly discoveryOutcome: CapabilityDiscoveryOutcome;
  readonly errorCode?: string; // SystemErrorCode (AP-xxx)
  readonly readLatencyMs?: number;
}

export interface CapabilityModule {
  readonly name: string;
  readonly protocol: string;
  readonly isReachable: boolean;
  readonly supportedSignals: readonly CapabilitySignal[];
}

export interface CapabilitySnapshot {
  readonly modules: readonly CapabilityModule[];
  readonly capturedAt: UtcIsoTimestamp;
}
