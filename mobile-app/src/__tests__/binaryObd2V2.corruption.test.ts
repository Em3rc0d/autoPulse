import { BinaryFixedV1Adapter } from '../infrastructure/database/benchmark/BinaryFixedV1Adapter';

describe('BinaryFixedV1Adapter Corruption OBD2 v2', () => {
  const adapter = new BinaryFixedV1Adapter();
  let validPayload: Uint8Array;

  beforeAll(() => {
    const edgeCases = [{
      timestampMs: 1672531200000,
      sequenceNumber: 1,
      protocolCode: 1,
      events: [
        {
          requestSequence: 1,
          ecuAddress: 0x07E8, service: 0x01, pid: 0x0C,
          requestDelta: 10, responseDelta: 20, decodeDelta: 2,
          outcome: 'VALUE' as const, connectionState: 'CONNECTED' as const,
          readings: [{ signalDefinitionId: 'ENGINE_RPM', normalizedValue: 2500, unit: 'RPM', quality: 'VALID' as const }]
        }
      ]
    }];
    const encoded = adapter.encode(edgeCases);
    validPayload = encoded.payload as Uint8Array;
  });

  it('should reject invalid magic bytes', () => {
    const corrupt = new Uint8Array(validPayload);
    corrupt[0] = 0x00;
    const res = adapter.decode(corrupt);
    expect(res.errors).toContain('Invalid magic bytes');
  });

  it('should detect unsupported version', () => {
    const corrupt = new Uint8Array(validPayload);
    corrupt[4] = 0x99;
    const res = adapter.decode(corrupt);
    expect(res.errors.some(e => e.includes('Unsupported version'))).toBe(true);
  });

  it('should detect payload length mismatch', () => {
    const corrupt = new Uint8Array(validPayload);
    corrupt[32] = 0xFF; // Modify totalBytes header
    const res = adapter.decode(corrupt);
    expect(res.errors.some(e => e.includes('Payload length mismatch'))).toBe(true);
  });

  it('should catch CRC mismatch', () => {
    const corrupt = new Uint8Array(validPayload);
    corrupt[corrupt.length - 1] = ~corrupt[corrupt.length - 1]; // Flip a data byte
    const res = adapter.decode(corrupt);
    expect(res.errors.some(e => e.includes('CRC mismatch'))).toBe(true);
  });

  it('should catch truncated payloads during dictionary read', () => {
    const corrupt = new Uint8Array(validPayload.buffer, validPayload.byteOffset, 42);
    const res = adapter.decode(corrupt);
    expect(res.errors.some(e => e.includes('Parse error')) || res.errors.some(e => e.includes('mismatch'))).toBe(true);
  });
});
