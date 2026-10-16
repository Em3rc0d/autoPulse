import { customType } from 'drizzle-orm/sqlite-core';

/**
 * Expo SQLite returns BLOB values as typed-array compatible binary data on Hermes.
 * Drizzle's stock SQLite blob mapper is Node-oriented and can touch the global
 * `Buffer`, which Hermes does not provide. Keep telemetry payloads Buffer-free and
 * normalize the small set of driver representations we accept into Uint8Array.
 */
export function normalizeHermesBlob(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (Array.isArray(value) && value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return Uint8Array.from(value);
  }

  throw new Error('UNSUPPORTED_SQLITE_BLOB_DRIVER_VALUE');
}

export const hermesBlob = customType<{
  data: Uint8Array;
  driverData: Uint8Array;
}>({
  dataType() {
    return 'blob';
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return normalizeHermesBlob(value);
  },
});
