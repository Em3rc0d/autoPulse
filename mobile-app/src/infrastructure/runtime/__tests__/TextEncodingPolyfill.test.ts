import {
  decodeUtf8,
  encodeUtf8,
  installTextEncodingPolyfill,
} from '../TextEncodingPolyfill';

describe('TextEncodingPolyfill', () => {
  it('round-trips AutoPulse dictionary strings without native TextEncoder/TextDecoder', () => {
    const value = 'ENGINE_COOLANT · °C · AutoPulse 🚗';
    expect(decodeUtf8(encodeUtf8(value))).toBe(value);
  });

  it('installs only the missing Hermes globals', () => {
    const target: any = {};
    installTextEncodingPolyfill(target);

    expect(typeof target.TextEncoder).toBe('function');
    expect(typeof target.TextDecoder).toBe('function');
    expect(new target.TextDecoder().decode(new target.TextEncoder().encode('309 m · 14.5 V')))
      .toBe('309 m · 14.5 V');
  });

  it('does not replace native implementations when they exist', () => {
    class NativeEncoder { encode() { return new Uint8Array([65]); } }
    class NativeDecoder { decode() { return 'native'; } }
    const target: any = { TextEncoder: NativeEncoder, TextDecoder: NativeDecoder };

    installTextEncodingPolyfill(target);

    expect(target.TextEncoder).toBe(NativeEncoder);
    expect(target.TextDecoder).toBe(NativeDecoder);
  });
});
