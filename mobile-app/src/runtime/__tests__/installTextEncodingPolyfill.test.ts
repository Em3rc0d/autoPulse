describe('installTextEncodingPolyfill', () => {
  const originalTextEncoder = (globalThis as any).TextEncoder;
  const originalTextDecoder = (globalThis as any).TextDecoder;

  afterEach(() => {
    (globalThis as any).TextEncoder = originalTextEncoder;
    (globalThis as any).TextDecoder = originalTextDecoder;
    jest.resetModules();
  });

  it('restores UTF-8 encode/decode when Hermes-style globals are missing', () => {
    (globalThis as any).TextEncoder = undefined;
    (globalThis as any).TextDecoder = undefined;

    jest.isolateModules(() => {
      require('../installTextEncodingPolyfill');
      const { BinaryObd2V3Codec } = require('../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec');
      const codec = new BinaryObd2V3Codec();
      const sample = 'AutoPulse ✓ RPM °C';

      const encoded = (codec as any).encodeString(sample) as Uint8Array;
      const decoded = (codec as any).decodeString(encoded) as string;

      expect(decoded).toBe(sample);
      expect(typeof (globalThis as any).TextDecoder).toBe('function');
      expect(typeof (globalThis as any).TextEncoder).toBe('function');
    });
  });
});
