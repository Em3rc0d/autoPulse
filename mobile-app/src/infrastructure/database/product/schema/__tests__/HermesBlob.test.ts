import { normalizeHermesBlob } from '../HermesBlob';
import { telemetryBlocks } from '../live';

describe('Hermes-safe telemetry BLOB mapping', () => {
  it('normalizes Uint8Array and ArrayBuffer without requiring Node Buffer', () => {
    const bytes = new Uint8Array([1, 2, 3, 255]);
    expect(Array.from(normalizeHermesBlob(bytes))).toEqual([1, 2, 3, 255]);
    expect(Array.from(normalizeHermesBlob(bytes.buffer))).toEqual([1, 2, 3, 255]);
  });

  it('keeps the telemetry column readable when global Buffer is absent', () => {
    const target = globalThis as typeof globalThis & { Buffer?: unknown };
    const original = target.Buffer;

    try {
      target.Buffer = undefined;
      const mapped = (telemetryBlocks.payloadBlob as any).mapFromDriverValue(new Uint8Array([9, 8, 7]));
      expect(mapped).toBeInstanceOf(Uint8Array);
      expect(Array.from(mapped)).toEqual([9, 8, 7]);
    } finally {
      target.Buffer = original;
    }
  });

  it('rejects non-binary driver values instead of coercing them', () => {
    expect(() => normalizeHermesBlob('not-bytes')).toThrow('UNSUPPORTED_SQLITE_BLOB_DRIVER_VALUE');
    expect(() => normalizeHermesBlob([1, -1, 300])).toThrow('UNSUPPORTED_SQLITE_BLOB_DRIVER_VALUE');
  });
});
