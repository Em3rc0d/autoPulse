import type { DiagnosticProtocol } from '../../../../domain/diagnostics/DiagnosticConnector';
import {
  DiagnosticServiceEnvelope,
  PositiveDiagnosticServiceEnvelope,
} from '../DiagnosticServiceEnvelope';
import { decodeDtcPair } from '../DtcPairDecoder';
import { parseDtcServiceEnvelope } from '../DtcServiceParser';

function positive(
  requestService: string,
  responseService: string,
  payload: readonly number[],
  protocol: DiagnosticProtocol = 'ISO_14230_KWP',
): PositiveDiagnosticServiceEnvelope {
  return {
    kind: 'POSITIVE_RESPONSE',
    requestService,
    responseService,
    payload,
    protocol,
    sourceEndpointId: 'ecu-1',
    provenance: 'fixture:mk4',
    observedAt: 100,
  };
}

function outcome(kind: Exclude<DiagnosticServiceEnvelope['kind'], 'POSITIVE_RESPONSE'>): DiagnosticServiceEnvelope {
  const base = {
    requestService: '03',
    protocol: 'ISO_14230_KWP' as const,
    sourceEndpointId: 'ecu-1',
    provenance: 'fixture:mk4',
    observedAt: 100,
  };
  switch (kind) {
    case 'NEGATIVE_RESPONSE': return { ...base, kind, negativeResponseCode: '11' };
    case 'PARTIAL': return { ...base, kind, responseService: '43', payload: [0x03], detail: 'truncated' };
    case 'INVALID_RESPONSE': return { ...base, kind, detail: 'malformed' };
    case 'NO_DATA':
    case 'TIMEOUT':
    case 'DISCONNECTED':
    case 'UNSUPPORTED':
      return { ...base, kind };
  }
}

describe('CHECK-MK4 DTC service parser', () => {
  it('decodes the two-byte DTC primitive and treats 0000 as padding', () => {
    expect(decodeDtcPair(0x03, 0x01)).toMatchObject({ code: 'P0301', family: 'POWERTRAIN' });
    expect(decodeDtcPair(0x00, 0x00)).toBeNull();
    expect(() => decodeDtcPair(0x100, 0x00)).toThrow('Invalid DTC byte pair');
  });

  it('decodes legacy/KWP stored DTCs without inventing a PID byte', () => {
    const result = parseDtcServiceEnvelope('03', positive('03', '43', [0x01, 0x33, 0x00, 0x00]));
    expect(result.outcome).toBe('SUCCESS_WITH_CODES');
    expect(result.status).toBe('STORED');
    expect(result.codes.map(item => item.code)).toEqual(['P0133']);
    expect(result.sourceEndpointId).toBe('ecu-1');
  });

  it('keeps CAN Mode 03 item count outside DTC bytes', () => {
    const result = parseDtcServiceEnvelope(
      '03',
      positive('03', '43', [0x01, 0x01, 0x33], 'ISO_15765_CAN'),
    );
    expect(result.outcome).toBe('SUCCESS_WITH_CODES');
    expect(result.declaredCount).toBe(1);
    expect(result.codes.map(item => item.code)).toEqual(['P0133']);
  });

  it('decodes multiple CAN Mode 03 codes and validates the declared count', () => {
    const result = parseDtcServiceEnvelope(
      '03',
      positive('03', '43', [0x02, 0x03, 0x01, 0x04, 0x20], 'ISO_15765_CAN'),
    );
    expect(result.outcome).toBe('SUCCESS_WITH_CODES');
    expect(result.codes.map(item => item.code)).toEqual(['P0301', 'P0420']);

    const truncated = parseDtcServiceEnvelope(
      '03',
      positive('03', '43', [0x02, 0x03, 0x01], 'ISO_15765_CAN'),
    );
    expect(truncated.outcome).toBe('INVALID_RESPONSE');
    expect(truncated.limitation).toContain('truncated');
  });

  it('represents a valid zero-code result without conflating NO DATA', () => {
    const legacyZero = parseDtcServiceEnvelope('03', positive('03', '43', [0x00, 0x00, 0x00, 0x00]));
    const canZero = parseDtcServiceEnvelope('03', positive('03', '43', [0x00], 'ISO_15765_CAN'));
    const noData = parseDtcServiceEnvelope('03', outcome('NO_DATA'));

    expect(legacyZero.outcome).toBe('SUCCESS_ZERO_CODES');
    expect(canZero.outcome).toBe('SUCCESS_ZERO_CODES');
    expect(noData.outcome).toBe('NO_DATA');
  });

  it('preserves pending and permanent status independently', () => {
    const pending = parseDtcServiceEnvelope('07', positive('07', '47', [0x03, 0x01]));
    const permanent = parseDtcServiceEnvelope('0A', positive('0A', '4A', [0x04, 0x20]));
    expect(pending.status).toBe('PENDING');
    expect(pending.codes[0].code).toBe('P0301');
    expect(permanent.status).toBe('PERMANENT');
    expect(permanent.codes[0].code).toBe('P0420');
  });

  it('normalizes duplicate codes without losing occurrence evidence', () => {
    const result = parseDtcServiceEnvelope('03', positive('03', '43', [0x03, 0x01, 0x03, 0x01, 0x00, 0x00]));
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].code).toBe('P0301');
    expect(result.codes[0].occurrenceCount).toBe(2);
    expect(result.codes[0].rawPairs).toHaveLength(2);
  });

  it('fails closed on unproven protocol/service envelopes', () => {
    const unknown = parseDtcServiceEnvelope('03', positive('03', '43', [0x03, 0x01], 'UNKNOWN'));
    expect(unknown.outcome).toBe('INVALID_RESPONSE');
    expect(unknown.limitation).toContain('not proven');

    const canPending = parseDtcServiceEnvelope('07', positive('07', '47', [0x01, 0x03, 0x01], 'ISO_15765_CAN'));
    expect(canPending.outcome).toBe('INVALID_RESPONSE');
    expect(canPending.limitation).toContain('refuses to guess');
  });

  it('fails closed when parser service and envelope request service disagree', () => {
    const mismatchedPositive = parseDtcServiceEnvelope('03', positive('07', '43', [0x03, 0x01]));
    expect(mismatchedPositive.outcome).toBe('INVALID_RESPONSE');
    expect(mismatchedPositive.limitation).toContain('does not match parser service');

    const mismatchedNoData: DiagnosticServiceEnvelope = {
      kind: 'NO_DATA', requestService: '07', protocol: 'ISO_14230_KWP', sourceEndpointId: 'ecu-1',
      provenance: 'fixture:mismatch', observedAt: 101,
    };
    expect(parseDtcServiceEnvelope('03', mismatchedNoData).outcome).toBe('INVALID_RESPONSE');
  });

  it('rejects malformed lengths and unexpected response services', () => {
    expect(parseDtcServiceEnvelope('03', positive('03', '43', [0x03])).outcome).toBe('INVALID_RESPONSE');
    expect(parseDtcServiceEnvelope('03', positive('03', '47', [0x03, 0x01])).outcome).toBe('INVALID_RESPONSE');

    const extraCanData = parseDtcServiceEnvelope(
      '03',
      positive('03', '43', [0x01, 0x03, 0x01, 0x12], 'ISO_15765_CAN'),
    );
    expect(extraCanData.outcome).toBe('INVALID_RESPONSE');
    expect(extraCanData.limitation).toContain('non-zero bytes');
  });

  it.each([
    ['NEGATIVE_RESPONSE', 'NEGATIVE_RESPONSE'],
    ['TIMEOUT', 'TIMEOUT'],
    ['DISCONNECTED', 'DISCONNECTED'],
    ['UNSUPPORTED', 'UNSUPPORTED'],
    ['PARTIAL', 'PARTIAL'],
    ['INVALID_RESPONSE', 'INVALID_RESPONSE'],
  ] as const)('preserves %s as a distinct parser outcome', (kind, expected) => {
    const result = parseDtcServiceEnvelope('03', outcome(kind));
    expect(result.outcome).toBe(expected);
    expect(result.codes).toEqual([]);
  });
});
