import { parseDtcServiceEnvelope } from '../DtcServiceParser';

describe('CHECK-MK4 DTC response evidence truth', () => {
  it('does not claim a response service was observed for NO DATA', () => {
    const result = parseDtcServiceEnvelope('03', {
      kind: 'NO_DATA',
      requestService: '03',
      protocol: 'ISO_14230_KWP',
      sourceEndpointId: 'ecu-1',
      provenance: 'fixture:no-data',
      observedAt: 100,
    });

    expect(result.expectedResponseService).toBe('43');
    expect(result.observedResponseService).toBeUndefined();
    expect(result.outcome).toBe('NO_DATA');
  });

  it('records an actually observed positive response service separately', () => {
    const result = parseDtcServiceEnvelope('03', {
      kind: 'POSITIVE_RESPONSE',
      requestService: '03',
      responseService: '43',
      payload: [0x03, 0x01],
      protocol: 'ISO_14230_KWP',
      sourceEndpointId: 'ecu-1',
      provenance: 'fixture:positive',
      observedAt: 101,
    });

    expect(result.expectedResponseService).toBe('43');
    expect(result.observedResponseService).toBe('43');
    expect(result.outcome).toBe('SUCCESS_WITH_CODES');
  });
});
