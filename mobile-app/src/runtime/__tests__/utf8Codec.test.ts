import { decodeUtf8, encodeUtf8 } from '../installTextEncodingPolyfill';

describe('portable UTF-8 codec', () => {
  it('round-trips ASCII, degree symbols, checkmarks and surrogate pairs', () => {
    const sample = 'AutoPulse ✓ RPM °C 🚗';
    expect(decodeUtf8(encodeUtf8(sample))).toBe(sample);
  });

  it('replaces malformed UTF-8 rather than throwing during summary reconstruction', () => {
    expect(decodeUtf8(Uint8Array.from([0xe2, 0x28, 0xa1]))).toContain('\ufffd');
  });
});
