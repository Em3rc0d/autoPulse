import { StandardJsonAdapter } from '../infrastructure/database/benchmark/StandardJsonAdapter';
import { CompactArrayJsonAdapter } from '../infrastructure/database/benchmark/CompactArrayJsonAdapter';
import { BinaryFixedV1Adapter } from '../infrastructure/database/benchmark/BinaryFixedV1Adapter';

describe('Payload Adapters OBD2 v2', () => {
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
      },
      {
        requestSequence: 2,
        requestDelta: 100,
        outcome: 'CONNECTION_ERROR' as const, errorCode: 'ADAPTER_DISCONNECTED' as const, connectionState: 'DISCONNECTED' as const,
        readings: []
      }
    ]
  }];

  const adapters = [
    new StandardJsonAdapter(),
    new CompactArrayJsonAdapter(),
    new BinaryFixedV1Adapter()
  ];

  for (const adapter of adapters) {
    it(`should roundtrip ${adapter.formatId} without data loss`, () => {
      const encoded = adapter.encode(edgeCases);
      expect(encoded.eventCount).toBe(2);
      expect(encoded.readingCount).toBe(1);

      const decoded = adapter.decode(encoded.payload);
      expect(decoded.errors.length).toBe(0);
      expect(decoded.eventCount).toBe(2);
      expect(decoded.readingCount).toBe(1);

      const ev1 = decoded.frames[0].events[0];
      expect(ev1.outcome).toBe('VALUE');
      expect(ev1.ecuAddress).toBe(0x07E8);
      expect(ev1.readings[0].normalizedValue).toBeCloseTo(2500, 3);

      const ev2 = decoded.frames[0].events[1];
      expect(ev2.outcome).toBe('CONNECTION_ERROR');
      expect(ev2.errorCode).toBe('ADAPTER_DISCONNECTED');
    });
  }
});
