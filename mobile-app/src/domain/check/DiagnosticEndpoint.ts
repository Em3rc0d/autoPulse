import type { DiagnosticProtocol } from '../diagnostics/DiagnosticConnector';

export type DiagnosticEndpointRole =
  | 'UNKNOWN'
  | 'ENGINE'
  | 'TRANSMISSION'
  | 'ABS'
  | 'SRS'
  | 'BODY'
  | 'STEERING'
  | 'HVAC'
  | 'OTHER';

export type DiagnosticTruthStage = 'REFERENCE_DEFINED' | 'ECU_ADVERTISED' | 'QUERIED' | 'OBSERVED';
export type DiagnosticObservationOutcome = 'OBSERVED' | 'NO_DATA' | 'INVALID' | 'TIMEOUT' | 'UNSUPPORTED';
export type DiagnosticEndpointScanStatus = 'NOT_EVALUATED' | 'PARTIAL' | 'COMPLETE' | 'FAILED' | 'DISCONNECTED';

export interface DiagnosticIdentityEvidence {
  readonly key: string;
  readonly value: string;
  readonly provenance: string;
  readonly observedAt: number;
}

export interface DiagnosticServiceObservation {
  readonly service: string;
  readonly stage: DiagnosticTruthStage;
  readonly outcome?: DiagnosticObservationOutcome;
  readonly observedAt?: number;
  readonly provenance: string;
}

export interface DiagnosticPidSupport {
  readonly pid: string;
  readonly stage: 'REFERENCE_DEFINED' | 'ECU_ADVERTISED';
  readonly provenance: string;
}

export interface DiagnosticEndpoint {
  readonly endpointId: string;
  readonly sourceAddress?: string;
  readonly protocol: DiagnosticProtocol;
  readonly role: DiagnosticEndpointRole;
  readonly roleConfidence: 'CONFIRMED_BY_ECU' | 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';
  readonly identityEvidence: readonly DiagnosticIdentityEvidence[];
  readonly supportedServices: readonly DiagnosticServiceObservation[];
  readonly supportedPids: readonly DiagnosticPidSupport[];
  readonly scanStatus: DiagnosticEndpointScanStatus;
}
