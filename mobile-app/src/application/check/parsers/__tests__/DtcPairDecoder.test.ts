import { decodeDtcPair } from '../DtcPairDecoder';

describe('CHECK-MK4 DTC pair decoder', () => {
  it.each([
    [0x03, 0x01, 'P0301', 'POWERTRAIN'],
    [0x80, 0x01, 'B0001', 'BODY'],
    [0x40, 0x35, 'C0035', 'CHASSIS'],
    [0xC1, 0x00, 'U0100', 'NETWORK'],
  ] as const)('decodes %s %s as %s', (first, second, code, family) => {
    expect(decodeDtcPair(first, second)).toEqual({
      code,
      family,
      rawPair: [first, second],
    });
  });

  it('treats 0000 only as padding/no-code', () => {
    expect(decodeDtcPair(0x00, 0x00)).toBeNull();
    expect(decodeDtcPair(0x00, 0x01)?.code).toBe('P0001');
  });
});
