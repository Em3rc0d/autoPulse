import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';

export type DiagnosticServiceEnvelopeKind =
  | 'POSITIVE_RESPONSE'
  | 'NEGATIVE_RESPONSE'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'UNSUPPORTED'
  | 'PARTIAL'
  | 'INVALID_RESPONSE';

interface DiagnosticServiceEnvelopeBase {
  readonly requestService: string;
  readonly protocol: DiagnosticProtocol;
  readonly sourceEndpointId: string | null;
  readonly provenance: string;
  readonly observedAt: number;
  readonly rawText?: string;
}

export interface PositiveDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'POSITIVE_RESPONSE';
  /** Positive response service byte, for example 43 for a Mode 03 request. */
  readonly responseService: string;
  /** Bytes after the response-service byte, already transport-reassembled. */
  readonly payload: readonly number[];
}

export interface NegativeDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'NEGATIVE_RESPONSE';
  readonly negativeResponseCode: string;
}

export interface NoDataDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'NO_DATA';
}

export interface TimeoutDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'TIMEOUT';
}

export interface DisconnectedDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'DISCONNECTED';
}

export interface UnsupportedDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'UNSUPPORTED';
}

export interface PartialDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'PARTIAL';
  readonly responseService?: string;
  readonly payload?: readonly number[];
  readonly detail?: string;
}

export interface InvalidDiagnosticServiceEnvelope extends DiagnosticServiceEnvelopeBase {
  readonly kind: 'INVALID_RESPONSE';
  readonly detail?: string;
}

/**
 * Transport-independent semantic envelope consumed by Check parsers.
 * Creating one of these does not send a request; transport adapters/replay code
 * are responsible for reassembly and source attribution before parsing.
 */
export type DiagnosticServiceEnvelope =
  | PositiveDiagnosticServiceEnvelope
  | NegativeDiagnosticServiceEnvelope
  | NoDataDiagnosticServiceEnvelope
  | TimeoutDiagnosticServiceEnvelope
  | DisconnectedDiagnosticServiceEnvelope
  | UnsupportedDiagnosticServiceEnvelope
  | PartialDiagnosticServiceEnvelope
  | InvalidDiagnosticServiceEnvelope;

export function isDiagnosticByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xff;
}

export function areDiagnosticBytes(values: readonly number[]): boolean {
  return values.every(isDiagnosticByte);
}
