import type { DiagnosticServiceEnvelope } from '../DiagnosticServiceEnvelope';
import { parseMode01DirectObservation } from '../Mode01DirectObservationParser';

const positive = (payload: readonly number[], sourceEndpointId: string | null = null): DiagnosticServiceEnvelope => ({
  kind: 'POSITIVE_RESPONSE',
  requestService: '01',
  responseService: '41',
  payload,
  protocol: 'ISO_14230_KWP',
  sourceEndpointId,
  provenance: 'fixture:mode01-direct',
  observedAt: 100,
  rawText: 'fixture',
});

describe('Mode01DirectObservationParser', () => {
  test('accepts an exact one-byte coolant response as OBSERVED_DIRECTLY', () => {
    const result = parseMode01DirectObservation('05', positive([0x05, 0x7d], 'ecu-a'));
    expect(result.outcome).toBe('OBSERVED_DIRECTLY');
    expect(result.requestPid).toBe('05');
    expect(result.dataBytes).toEqual([0x7d]);
    expect(result.sourceEndpointId).toBe('ecu-a');
  });

  test('preserves multi-byte RPM data without claiming meaning or advertised support', () => {
    const result = parseMode01DirectObservation('0C', positive([0x0c, 0x1a, 0xf8]));
    expect(result.outcome).toBe('OBSERVED_DIRECTLY');
    expect(result.dataBytes).toEqual([0x1a, 0xf8]);
    expect((result as any).advertisedPids).toBeUndefined();
  });

  test('fails closed on echoed PID mismatch', () => {
    const result = parseMode01DirectObservation('0D', positive([0x0c, 0x22]));
    expect(result.outcome).toBe('INVALID_RESPONSE');
    expect(result.dataBytes).toEqual([]);
  });

  test('fails closed when no data byte follows the echoed PID', () => {
    expect(parseMode01DirectObservation('05', positive([0x05])).outcome).toBe('INVALID_RESPONSE');
  });

  test('keeps NO_DATA distinct from unsupported', () => {
    const result = parseMode01DirectObservation('05', {
      kind: 'NO_DATA',
      requestService: '01',
      protocol: 'ISO_14230_KWP',
      sourceEndpointId: null,
      provenance: 'fixture:no-data',
      observedAt: 100,
    });
    expect(result.outcome).toBe('NO_DATA');
  });

  test('retains negative response code without turning it into unsupported PID evidence', () => {
    const result = parseMode01DirectObservation('05', {
      kind: 'NEGATIVE_RESPONSE',
      requestService: '01',
      negativeResponseCode: '11',
      protocol: 'ISO_14230_KWP',
      sourceEndpointId: null,
      provenance: 'fixture:nrc',
      observedAt: 100,
    });
    expect(result.outcome).toBe('NEGATIVE_RESPONSE');
    expect(result.negativeResponseCode).toBe('11');
  });
});
