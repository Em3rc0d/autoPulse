import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import { areDiagnosticBytes, type DiagnosticServiceEnvelope } from './DiagnosticServiceEnvelope';

export type Mode01DirectObservationOutcome =
  | 'OBSERVED_DIRECTLY'
  | 'NO_DATA'
  | 'NEGATIVE_RESPONSE'
  | 'RESPONSE_PENDING'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'PARTIAL'
  | 'INVALID_RESPONSE';

export interface Mode01DirectObservationResult {
  readonly requestPid: string;
  readonly sourceEndpointId: string | null;
  readonly protocol: DiagnosticProtocol;
  readonly outcome: Mode01DirectObservationOutcome;
  readonly dataBytes: readonly number[];
  readonly rawPayload: readonly number[];
  readonly provenance: string;
  readonly observedAt: number;
  readonly negativeResponseCode?: string;
  readonly limitation?: string;
}

function baseResult(
  requestPid: string,
  envelope: DiagnosticServiceEnvelope,
  outcome: Mode01DirectObservationOutcome,
  limitation?: string,
): Mode01DirectObservationResult {
  return Object.freeze({
    requestPid,
    sourceEndpointId: envelope.sourceEndpointId,
    protocol: envelope.protocol,
    outcome,
    dataBytes: Object.freeze([]),
    rawPayload: Object.freeze(envelope.kind === 'POSITIVE_RESPONSE' ? [...envelope.payload] : []),
    provenance: envelope.provenance,
    observedAt: envelope.observedAt,
    ...(envelope.kind === 'NEGATIVE_RESPONSE' ? { negativeResponseCode: envelope.negativeResponseCode } : {}),
    ...(limitation ? { limitation } : {}),
  });
}

/**
 * Parses one exact Mode 01 PID observation.
 *
 * This result is deliberately OBSERVED_DIRECTLY evidence. It must never be
 * promoted into ECU_ADVERTISED support merely because the request succeeded.
 */
export function parseMode01DirectObservation(
  requestPid: string,
  envelope: DiagnosticServiceEnvelope,
): Mode01DirectObservationResult {
  const pid = requestPid.trim().toUpperCase();
  if (!/^[0-9A-F]{2}$/.test(pid)) {
    return baseResult(requestPid, envelope, 'INVALID_RESPONSE', 'Requested Mode 01 PID must be exactly one byte');
  }

  switch (envelope.kind) {
    case 'POSITIVE_RESPONSE': {
      if (envelope.requestService.toUpperCase() !== '01' || envelope.responseService.toUpperCase() !== '41') {
        return baseResult(pid, envelope, 'INVALID_RESPONSE', 'Mode 01 direct observation service envelope mismatch');
      }
      if (!areDiagnosticBytes(envelope.payload) || envelope.payload.length < 2) {
        return baseResult(pid, envelope, 'INVALID_RESPONSE', 'Mode 01 direct observation requires echoed PID plus at least one data byte');
      }
      const expectedPid = Number.parseInt(pid, 16);
      if (envelope.payload[0] !== expectedPid) {
        return baseResult(pid, envelope, 'INVALID_RESPONSE', 'Mode 01 direct observation echoed PID mismatch');
      }
      return Object.freeze({
        requestPid: pid,
        sourceEndpointId: envelope.sourceEndpointId,
        protocol: envelope.protocol,
        outcome: 'OBSERVED_DIRECTLY' as const,
        dataBytes: Object.freeze(envelope.payload.slice(1)),
        rawPayload: Object.freeze([...envelope.payload]),
        provenance: envelope.provenance,
        observedAt: envelope.observedAt,
      });
    }
    case 'NEGATIVE_RESPONSE':
      return baseResult(
        pid,
        envelope,
        envelope.negativeResponseCode.toUpperCase() === '78' ? 'RESPONSE_PENDING' : 'NEGATIVE_RESPONSE',
      );
    case 'NO_DATA': return baseResult(pid, envelope, 'NO_DATA');
    case 'TIMEOUT': return baseResult(pid, envelope, 'TIMEOUT');
    case 'DISCONNECTED': return baseResult(pid, envelope, 'DISCONNECTED');
    case 'UNSUPPORTED': return baseResult(pid, envelope, 'UNSUPPORTED');
    case 'FAILED': return baseResult(pid, envelope, 'FAILED');
    case 'PARTIAL': return baseResult(pid, envelope, 'PARTIAL');
    case 'INVALID_RESPONSE': return baseResult(pid, envelope, 'INVALID_RESPONSE');
  }
}
