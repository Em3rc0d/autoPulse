import { sha256HexUtf8 } from '../PureJsReportIntegrityHasher';

describe('PureJsReportIntegrityHasher', () => {
  it('matches the SHA-256 empty-string vector', () => {
    expect(sha256HexUtf8('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('matches the SHA-256 abc vector', () => {
    expect(sha256HexUtf8('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes UTF-8 deterministically without TextEncoder globals', () => {
    const before = (globalThis as any).TextEncoder;
    try {
      delete (globalThis as any).TextEncoder;
      expect(sha256HexUtf8('AutoPulse 🚗')).toBe(sha256HexUtf8('AutoPulse 🚗'));
    } finally {
      (globalThis as any).TextEncoder = before;
    }
  });
});
