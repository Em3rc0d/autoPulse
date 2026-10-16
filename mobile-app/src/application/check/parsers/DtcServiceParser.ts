import type {
  DiagnosticTroubleCodeFamily,
  DiagnosticTroubleCodeStatus,
} from '../../../domain/check/DiagnosticTroubleCode';
import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import { decodeDtcPair } from './DtcPairDecoder';
import {
  areDiagnosticBytes,
  DiagnosticServiceEnvelope,
  PositiveDiagnosticServiceEnvelope,
} from './DiagnosticServiceEnvelope';

export type DtcRequestService = '03' | '07' | '0A';

export type DtcServiceParseOutcome =
  | 'SUCCESS_WITH_CODES'
  | 'SUCCESS_ZERO_CODES'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'NEGATIVE_RESPONSE'
  | 'RESPONSE_PENDING'
  | 'DISCONNECTED'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'PARTIAL';

export interface ParsedDtcCode {
  readonly code: string;
  readonly family: DiagnosticTroubleCodeFamily;
  readonly rawPairs: readonly (readonly [number, number])[];
  readonly occurrenceCount: number;
}

export interface DtcServiceParseResult {
  readonly requestService: DtcRequestService;
  readonly expectedResponseService: '43' | '47' | '4A';
  /** Present only when a positive/partial response service was actually observed. */
  readonly observedResponseService?: string;
  readonly status: DiagnosticTroubleCodeStatus;
  readonly outcome: DtcServiceParseOutcome;
  readonly sourceEndpointId: string | null;
  readonly protocol: DiagnosticProtocol;
  readonly codes: readonly ParsedDtcCode[];
  readonly rawPayload: readonly number[];
  readonly declaredCount?: number;
  readonly negativeResponseCode?: string;
  readonly limitation?: string;
  readonly provenance: string;
  readonly observedAt: number;
}

const SERVICE_META: Readonly<Record<DtcRequestService, {
  readonly responseService: '43' | '47' | '4A';
  readonly status: DiagnosticTroubleCodeStatus;
}>> = {
  '03': { responseService: '43', status: 'STORED' },
  '07': { responseService: '47', status: 'PENDING' },
  '0A': { responseService: '4A', status: 'PERMANENT' },
};

const LEGACY_OBD_PROTOCOLS: readonly DiagnosticProtocol[] = [
  'ISO_14230_KWP',
  'ISO_9141_2',
  'SAE_J1850_PWM',
  'SAE_J1850_VPW',
];

function baseResult(service: DtcRequestService, envelope: DiagnosticServiceEnvelope): Omit<DtcServiceParseResult, 'outcome' | 'codes' | 'rawPayload'> {
  const meta = SERVICE_META[service];
  return {
    requestService: service,
    expectedResponseService: meta.responseService,
    status: meta.status,
    sourceEndpointId: envelope.sourceEndpointId,
    protocol: envelope.protocol,
    provenance: envelope.provenance,
    observedAt: envelope.observedAt,
  };
}

function normalizeCodes(pairs: readonly ReturnType<typeof decodeDtcPair>[]): ParsedDtcCode[] {
  const byCode = new Map<string, { family: DiagnosticTroubleCodeFamily; rawPairs: Array<readonly [number, number]> }>();
  for (const pair of pairs) {
    if (!pair) continue;
    const existing = byCode.get(pair.code);
    if (existing) {
      existing.rawPairs.push(pair.rawPair);
    } else {
      byCode.set(pair.code, { family: pair.family, rawPairs: [pair.rawPair] });
    }
  }
  return [...byCode.entries()].map(([code, data]) => ({
    code,
    family: data.family,
    rawPairs: data.rawPairs,
    occurrenceCount: data.rawPairs.length,
  }));
}

function decodeLegacyPayload(payload: readonly number[]): { codes?: ParsedDtcCode[]; error?: string } {
  if (!areDiagnosticBytes(payload)) return { error: 'DTC payload contains an invalid byte' };
  // A bare positive service byte proves that a positive response was seen, but
  // it does not prove an explicit zero-code list. Legacy zero-DTC promotion
  // requires at least one complete 0000 padding pair (or equivalent promoted
  // transport evidence), otherwise we fail closed instead of fabricating zero.
  if (payload.length === 0) return { error: 'Legacy DTC positive response has no DTC pair or padding evidence' };
  if (payload.length % 2 !== 0) return { error: 'Legacy DTC payload has an odd byte count' };

  const pairs: Array<ReturnType<typeof decodeDtcPair>> = [];
  for (let index = 0; index < payload.length; index += 2) {
    pairs.push(decodeDtcPair(payload[index], payload[index + 1]));
  }
  return { codes: normalizeCodes(pairs) };
}

function decodeCanStoredPayload(payload: readonly number[]): {
  codes?: ParsedDtcCode[];
  declaredCount?: number;
  error?: string;
} {
  if (!areDiagnosticBytes(payload)) return { error: 'CAN DTC payload contains an invalid byte' };
  if (payload.length < 1) return { error: 'CAN Mode 03 payload is missing the DTC item count byte' };

  const declaredCount = payload[0];
  const requiredBytes = declaredCount * 2;
  const dtcBytes = payload.slice(1);
  if (dtcBytes.length < requiredBytes) {
    return { declaredCount, error: `CAN Mode 03 declared ${declaredCount} DTC items but payload is truncated` };
  }

  const used = dtcBytes.slice(0, requiredBytes);
  const trailing = dtcBytes.slice(requiredBytes);
  if (trailing.some(byte => byte !== 0)) {
    return { declaredCount, error: 'CAN Mode 03 has non-zero bytes after the declared DTC list' };
  }

  const decodedPairs: Array<ReturnType<typeof decodeDtcPair>> = [];
  for (let index = 0; index < used.length; index += 2) {
    decodedPairs.push(decodeDtcPair(used[index], used[index + 1]));
  }
  const nonPaddingCount = decodedPairs.filter(Boolean).length;
  if (nonPaddingCount !== declaredCount) {
    return { declaredCount, error: `CAN Mode 03 count mismatch: declared ${declaredCount}, decoded ${nonPaddingCount}` };
  }

  return { declaredCount, codes: normalizeCodes(decodedPairs) };
}

function positiveResult(service: DtcRequestService, envelope: PositiveDiagnosticServiceEnvelope): DtcServiceParseResult {
  const meta = SERVICE_META[service];
  const base = {
    ...baseResult(service, envelope),
    observedResponseService: envelope.responseService.toUpperCase(),
  };
  if (base.observedResponseService !== meta.responseService) {
    return {
      ...base,
      outcome: 'INVALID_RESPONSE',
      codes: [],
      rawPayload: envelope.payload,
      limitation: `Unexpected positive response service ${envelope.responseService}; expected ${meta.responseService}`,
    };
  }

  if (envelope.protocol === 'ISO_15765_CAN') {
    // Only Mode 03's CAN count-byte envelope is closed by current research.
    if (service !== '03') {
      return {
        ...base,
        outcome: 'INVALID_RESPONSE',
        codes: [],
        rawPayload: envelope.payload,
        limitation: `CAN ${service} DTC envelope is not fixture-promoted; parser refuses to guess`,
      };
    }
    const decoded = decodeCanStoredPayload(envelope.payload);
    if (decoded.error) {
      return {
        ...base,
        outcome: 'INVALID_RESPONSE',
        codes: [],
        rawPayload: envelope.payload,
        declaredCount: decoded.declaredCount,
        limitation: decoded.error,
      };
    }
    return {
      ...base,
      outcome: decoded.codes!.length > 0 ? 'SUCCESS_WITH_CODES' : 'SUCCESS_ZERO_CODES',
      codes: decoded.codes!,
      rawPayload: envelope.payload,
      declaredCount: decoded.declaredCount,
    };
  }

  if (!LEGACY_OBD_PROTOCOLS.includes(envelope.protocol)) {
    return {
      ...base,
      outcome: 'INVALID_RESPONSE',
      codes: [],
      rawPayload: envelope.payload,
      limitation: `DTC response envelope is not proven for protocol ${envelope.protocol}`,
    };
  }

  const decoded = decodeLegacyPayload(envelope.payload);
  if (decoded.error) {
    return {
      ...base,
      outcome: 'INVALID_RESPONSE',
      codes: [],
      rawPayload: envelope.payload,
      limitation: decoded.error,
    };
  }
  return {
    ...base,
    outcome: decoded.codes!.length > 0 ? 'SUCCESS_WITH_CODES' : 'SUCCESS_ZERO_CODES',
    codes: decoded.codes!,
    rawPayload: envelope.payload,
  };
}

export function parseDtcServiceEnvelope(service: DtcRequestService, envelope: DiagnosticServiceEnvelope): DtcServiceParseResult {
  const base = baseResult(service, envelope);

  if (envelope.requestService.toUpperCase() !== service) {
    return {
      ...base,
      observedResponseService: envelope.kind === 'POSITIVE_RESPONSE' || envelope.kind === 'PARTIAL'
        ? envelope.responseService?.toUpperCase()
        : undefined,
      outcome: 'INVALID_RESPONSE',
      codes: [],
      rawPayload: envelope.kind === 'POSITIVE_RESPONSE' || envelope.kind === 'PARTIAL'
        ? envelope.payload ?? []
        : [],
      limitation: `Envelope request service ${envelope.requestService} does not match parser service ${service}`,
    };
  }

  switch (envelope.kind) {
    case 'POSITIVE_RESPONSE':
      return positiveResult(service, envelope);
    case 'NEGATIVE_RESPONSE': {
      const responseCode = envelope.negativeResponseCode.toUpperCase();
      return {
        ...base,
        outcome: responseCode === '78' ? 'RESPONSE_PENDING' : 'NEGATIVE_RESPONSE',
        codes: [],
        rawPayload: [],
        negativeResponseCode: responseCode,
        limitation: responseCode === '78'
          ? 'ECU reported Response Pending; transport/planner owns the bounded continuation deadline'
          : undefined,
      };
    }
    case 'NO_DATA':
      return { ...base, outcome: 'NO_DATA', codes: [], rawPayload: [] };
    case 'TIMEOUT':
      return { ...base, outcome: 'TIMEOUT', codes: [], rawPayload: [] };
    case 'DISCONNECTED':
      return { ...base, outcome: 'DISCONNECTED', codes: [], rawPayload: [] };
    case 'UNSUPPORTED':
      return { ...base, outcome: 'UNSUPPORTED', codes: [], rawPayload: [] };
    case 'FAILED':
      return {
        ...base,
        outcome: 'FAILED',
        codes: [],
        rawPayload: [],
        limitation: envelope.detail ?? 'Diagnostic transport/request failed',
      };
    case 'PARTIAL':
      return {
        ...base,
        observedResponseService: envelope.responseService?.toUpperCase(),
        outcome: 'PARTIAL',
        codes: [],
        rawPayload: envelope.payload ?? [],
        limitation: envelope.detail ?? 'Partial DTC response retained without speculative decoding',
      };
    case 'INVALID_RESPONSE':
      return {
        ...base,
        outcome: 'INVALID_RESPONSE',
        codes: [],
        rawPayload: [],
        limitation: envelope.detail ?? 'Invalid DTC response',
      };
  }
}
