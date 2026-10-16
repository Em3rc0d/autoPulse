import type { DiagnosticFreezeFrame } from '../../../domain/check/DiagnosticFreezeFrame';
import type { DiagnosticIdentityEvidence } from '../../../domain/check/DiagnosticEndpoint';
import type { DiagnosticMonitorResult } from '../../../domain/check/DiagnosticMonitorResult';
import type { DiagnosticReadiness } from '../../../domain/check/DiagnosticReadiness';
import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { PositiveDiagnosticServiceEnvelope } from './DiagnosticServiceEnvelope';

/**
 * Common pure-parser context. It deliberately contains no connector, BLE or command object.
 */
export interface DiagnosticParserContext {
  readonly protocol: DiagnosticProtocol;
  readonly sourceEndpointId: string | null;
  readonly provenance: string;
  readonly observedAt: number;
}

export type DiagnosticDecodeOutcome =
  | 'DECODED'
  | 'RAW_ONLY'
  | 'UNSUPPORTED'
  | 'INVALID';

export interface DiagnosticDecodeResult<T> {
  readonly outcome: DiagnosticDecodeOutcome;
  readonly value?: T;
  readonly rawPayload: readonly number[];
  readonly limitation?: string;
}

/**
 * Contract for future readiness/freeze-frame/Mode06/Service09 decoders.
 * Implementations may preserve RAW_ONLY evidence when semantics are not promoted,
 * but must never invent engineering values or human meaning.
 */
export interface PureDiagnosticServiceDecoder<T> {
  decode(envelope: PositiveDiagnosticServiceEnvelope): DiagnosticDecodeResult<T>;
}

export interface RawDiagnosticServiceObservation {
  readonly service: string;
  readonly pid?: string;
  readonly sourceEndpointId: string | null;
  readonly protocol: DiagnosticProtocol;
  readonly rawPayload: readonly number[];
  readonly provenance: string;
  readonly observedAt: number;
}

export interface ReadinessDecoder extends PureDiagnosticServiceDecoder<DiagnosticReadiness> {}
export interface FreezeFrameDecoder extends PureDiagnosticServiceDecoder<DiagnosticFreezeFrame> {}
export interface Mode06Decoder extends PureDiagnosticServiceDecoder<DiagnosticMonitorResult> {}
export interface Service09Decoder extends PureDiagnosticServiceDecoder<readonly DiagnosticIdentityEvidence[]> {}
