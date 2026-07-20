import { SignalId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';

export interface CapabilitySignal {
  readonly id: SignalId;
  readonly isSupported: boolean;
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
