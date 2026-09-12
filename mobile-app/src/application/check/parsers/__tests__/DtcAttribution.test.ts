import { parseDtcServiceEnvelope } from '../DtcServiceParser';

describe('CHECK-MK4 DTC attribution boundary', () => {
  it('keeps a valid response unattributed when source ownership is not observable', () => {
    const result = parseDtcServiceEnvelope('03', {
      kind: 'POSITIVE_RESPONSE',
      requestService: '03',
      responseService: '43',
      payload: [0x03, 0x01],
      protocol: 'ISO_14230_KWP',
      sourceEndpointId: null,
      provenance: 'fixture:unattributed',
      observedAt: 100,
    });

    expect(result.outcome).toBe('SUCCESS_WITH_CODES');
    expect(result.sourceEndpointId).toBeNull();
    expect(result.codes[0].code).toBe('P0301');
  });
});
