import type { PositiveDiagnosticServiceEnvelope } from '../DiagnosticServiceEnvelope';
import { parseDtcServiceEnvelope } from '../DtcServiceParser';

const positive = (payload: readonly number[]): PositiveDiagnosticServiceEnvelope => ({
  kind: 'POSITIVE_RESPONSE',
  requestService: '03',
  responseService: '43',
  payload,
  protocol: 'ISO_14230_KWP',
  sourceEndpointId: 'ecu-1',
  provenance: 'mk9:legacy-zero-proof',
  observedAt: 100,
});

describe('CHECK-MK9 legacy DTC zero-proof boundary', () => {
  it('fails closed on a bare positive service response with no pair/padding evidence', () => {
    const result = parseDtcServiceEnvelope('03', positive([]));
    expect(result.outcome).toBe('INVALID_RESPONSE');
    expect(result.codes).toEqual([]);
    expect(result.limitation).toContain('no DTC pair or padding evidence');
  });

  it('still accepts explicit 0000 padding as a zero-code legacy result', () => {
    const result = parseDtcServiceEnvelope('03', positive([0x00, 0x00]));
    expect(result.outcome).toBe('SUCCESS_ZERO_CODES');
    expect(result.codes).toEqual([]);
  });
});
