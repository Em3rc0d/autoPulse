import { describe, it, expect } from '@jest/globals';
import { BinaryObd2V2Codec } from '../binary-obd2-v2/BinaryObd2V2Codec';
import { Obd2AcquisitionEvent } from '../../../domain/telemetry';

describe('BinaryObd2V2Codec', () => {
  const codec = new BinaryObd2V2Codec();

  it('encodes and decodes an empty event array', () => {
    const result = codec.encode([]);
    expect(result.eventCount).toBe(0);
    expect((result.payload as Uint8Array).byteLength).toBe(40 + 4); // 40 bytes header + 4 bytes dict headers

    const decoded = codec.decode(result.payload);
    expect(decoded.events).toEqual([]);
    expect(decoded.errors.length).toBe(0);
  });

  it('validates a valid payload', () => {
    const result = codec.encode([]);
    const integrity = codec.validate(result.payload);
    expect(integrity.valid).toBe(true);
  });

  it('rejects an invalid magic byte payload', () => {
    const result = codec.encode([]);
    const badPayload = new Uint8Array(result.payload as Uint8Array);
    badPayload[0] = 0xFF; // Break magic

    const integrity = codec.validate(badPayload);
    expect(integrity.valid).toBe(false);
    expect(integrity.error).toMatch(/magic/i);

    const decoded = codec.decode(badPayload);
    expect(decoded.errors.some(e => e.includes('magic'))).toBe(true);
  });

  it('rejects payload with invalid CRC', () => {
    const result = codec.encode([]);
    const badPayload = new Uint8Array(result.payload as Uint8Array);
    badPayload[42] = 0xFF; // Modify some dictionary byte

    const integrity = codec.validate(badPayload);
    expect(integrity.valid).toBe(false);
    expect(integrity.expectedChecksum).not.toBe(integrity.actualChecksum);

    const decoded = codec.decode(badPayload);
    expect(decoded.errors.some(e => e.includes('CRC'))).toBe(true);
  });

  it('encodes and decodes a complex event with readings', () => {
    const events: Obd2AcquisitionEvent[] = [
      {
        requestSequence: 1,
        ecuAddress: 0x7E0,
        service: 1,
        pid: 0x0C,
        requestDelta: 10,
        responseDelta: 15,
        decodeDelta: 2,
        outcome: 'VALUE',
        connectionState: 'CONNECTED',
        readings: [
          {
            signalDefinitionId: 'ENGINE_RPM',
            normalizedValue: 2500.5,
            unit: 'rpm',
            quality: 'VALID'
          }
        ]
      },
      {
        requestSequence: 2,
        ecuAddress: 0x7E0,
        service: 1,
        pid: 0x0D,
        requestDelta: 12,
        outcome: 'TIMEOUT',
        errorCode: 'TIMEOUT',
        connectionState: 'CONNECTED',
        readings: []
      }
    ];

    const result = codec.encode(events);
    expect(result.eventCount).toBe(2);
    expect(result.readingCount).toBe(1);

    const decoded = codec.decode(result.payload);
    expect(decoded.errors.length).toBe(0);
    expect(decoded.eventCount).toBe(2);
    expect(decoded.readingCount).toBe(1);

    // Verify properties
    const ev0 = decoded.events[0];
    expect(ev0.ecuAddress).toBe(0x7E0);
    expect(ev0.service).toBe(1);
    expect(ev0.pid).toBe(0x0C);
    expect(ev0.outcome).toBe('VALUE');
    expect(ev0.readings.length).toBe(1);
    expect(ev0.readings[0].signalDefinitionId).toBe('ENGINE_RPM');
    expect(ev0.readings[0].normalizedValue).toBeCloseTo(2500.5);

    const ev1 = decoded.events[1];
    expect(ev1.outcome).toBe('TIMEOUT');
    expect(ev1.errorCode).toBe('TIMEOUT');
  });

  it('rejects truncated payloads', () => {
    const integrity = codec.validate(new Uint8Array(10)); // < 40 bytes
    expect(integrity.valid).toBe(false);
    expect(integrity.error).toMatch(/too small/i);
  });
});
