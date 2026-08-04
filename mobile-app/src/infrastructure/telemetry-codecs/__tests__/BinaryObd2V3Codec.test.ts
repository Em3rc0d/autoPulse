import { BinaryObd2V3Codec } from '../binary-obd2-v3/BinaryObd2V3Codec';
import { BinaryObd2V2Codec } from '../binary-obd2-v2/BinaryObd2V2Codec';
import { UnencodedTelemetryBlock } from '../../../domain/telemetry/models/UnencodedTelemetryBlock';

describe('BinaryObd2V3Codec', () => {
  const codec = new BinaryObd2V3Codec();
  const v2Codec = new BinaryObd2V2Codec();

  const createBaseBlock = (): UnencodedTelemetryBlock => ({
    sessionId: 'test_session',
    blockSequence: 1,
    windowIndex: 0,
    startedAt: 1000,
    endedAt: 6000,
    isPartial: false,
    events: [],
    eventCount: 0,
    readingCount: 0,
    firstEventSequence: 1,
    lastEventSequence: 1
  });

  it('Fixture A - Normal Block (RPM, Speed 0, Coolant, Negative Response)', () => {
    const block = createBaseBlock();
    block.events = [
      {
        sessionId: 'test_session',
        sequenceNumber: 1,
        requestId: 'req_1',
        requestedAt: 1100,
        completedAt: 1150,
        command: '010C',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 50,
        rawFragments: [],
        rawText: '410C0B6C\r',
        frames: [],
        decodedReadings: [{ signalId: 'RPM', service: '01', pid: '0C', value: 731, unit: 'RPM', rawBytes: [], origin: 'OBD2', quality: 'GOOD', sourceEcu: '7E8', observedAt: 1150 }],
        negativeResponses: [],
        status: 'SUCCESS',
        warnings: []
      },
      {
        sessionId: 'test_session',
        sequenceNumber: 2,
        requestId: 'req_2',
        requestedAt: 1200,
        completedAt: 1250,
        command: '010D',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 50,
        rawFragments: [],
        rawText: '410D00\r',
        frames: [],
        decodedReadings: [{ signalId: 'SPEED', service: '01', pid: '0D', value: 0, unit: 'km/h', rawBytes: [], origin: 'OBD2', quality: 'GOOD', sourceEcu: '7E8', observedAt: 1250 }],
        negativeResponses: [],
        status: 'SUCCESS',
        warnings: []
      },
      {
        sessionId: 'test_session',
        sequenceNumber: 3,
        requestId: 'req_3',
        requestedAt: 1300,
        completedAt: 1350,
        command: '0142',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 50,
        rawFragments: [],
        rawText: '7F0112\r',
        frames: [],
        decodedReadings: [],
        negativeResponses: [{ requestedService: '01', responseCode: '12' }],
        status: 'NEGATIVE_RESPONSE',
        warnings: []
      }
    ];
    block.eventCount = 3;
    block.readingCount = 2;
    block.firstEventSequence = 1;
    block.lastEventSequence = 3;

    const encoded = codec.encode(block);
    expect(encoded.payloadByteLength).toBeGreaterThan(40);
    expect(encoded.payloadCrc).toBeDefined();

    const decoded = codec.decode(encoded.payload, block);
    expect(decoded.eventCount).toBe(3);
    expect(decoded.events[1].decodedReadings[0].value).toBe(0); // Zero value preserved
    expect(decoded.events[2].status).toBe('NEGATIVE_RESPONSE');
    expect(decoded.events[2].negativeResponses).toHaveLength(1);
    expect(decoded.events[2].negativeResponses[0].responseCode).toBe('12');
  });

  it('Fixture B - Raw Fragments Preserved', () => {
    const block = createBaseBlock();
    block.events = [
      {
        sessionId: 'test_session',
        sequenceNumber: 1,
        requestId: 'req_1',
        requestedAt: 1100,
        completedAt: 1300,
        command: '010C',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 200,
        rawFragments: [
          { receivedAt: 1150, decodedText: 'SEARCHING...\r' },
          { receivedAt: 1250, decodedText: '410C0B' },
          { receivedAt: 1300, decodedText: '6C\r' }
        ],
        rawText: '',
        frames: [],
        decodedReadings: [],
        negativeResponses: [],
        status: 'SUCCESS',
        warnings: []
      }
    ];
    block.eventCount = 1;
    block.lastEventSequence = 1;

    const encoded = codec.encode(block);
    const decoded = codec.decode(encoded.payload, block);

    const ev = decoded.events[0];
    expect(ev.rawFragments).toHaveLength(3);
    expect(ev.rawFragments[0].decodedText).toBe('SEARCHING...\r');
    expect(ev.rawText).toBe('SEARCHING...\r410C0B6C\r'); // reconstructed correctly
  });

  it('Fixture C - NO_DATA and Cancelled', () => {
    const block = createBaseBlock();
    block.events = [
      {
        sessionId: 'test_session',
        sequenceNumber: 1,
        requestId: 'req_1',
        requestedAt: 1100,
        completedAt: 1150,
        command: '010C',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 50,
        rawFragments: [],
        rawText: 'NO DATA\r',
        frames: [],
        decodedReadings: [],
        negativeResponses: [],
        status: 'NO_DATA',
        warnings: []
      },
      {
        sessionId: 'test_session',
        sequenceNumber: 2,
        requestId: 'req_2',
        requestedAt: 1200,
        completedAt: 1210,
        command: '010D',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'CANCELLED',
        latencyMs: 10,
        rawFragments: [],
        rawText: '',
        frames: [],
        decodedReadings: [],
        negativeResponses: [],
        status: 'CANCELLED',
        warnings: []
      }
    ];
    block.eventCount = 2;
    block.lastEventSequence = 2;

    const encoded = codec.encode(block);
    const decoded = codec.decode(encoded.payload, block);

    expect(decoded.events[0].status).toBe('NO_DATA');
    expect(decoded.events[1].status).toBe('CANCELLED');
    expect(decoded.events[1].completionReason).toBe('CANCELLED');
  });

  it('Fixture E - Corruption and Format Rejection', () => {
    const block = createBaseBlock();
    block.events = [
      {
        sessionId: 'test_session',
        sequenceNumber: 1,
        requestId: 'req_1',
        requestedAt: 1100,
        completedAt: 1150,
        command: '010C',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 50,
        rawFragments: [],
        rawText: '',
        frames: [],
        decodedReadings: [],
        negativeResponses: [],
        status: 'SUCCESS',
        warnings: []
      }
    ];
    block.eventCount = 1;
    block.lastEventSequence = 1;

    const encoded = codec.encode(block);

    // Modify one byte to corrupt CRC
    const corruptPayload = new Uint8Array(encoded.payload);
    corruptPayload[15] ^= 0xFF;

    // Pass original context block which contains payloadCrc for validation
    expect(() => codec.decode(corruptPayload, encoded)).toThrowError(/CRC mismatch/);

    // Truncated
    const truncatedPayload = corruptPayload.slice(0, 20);
    expect(() => codec.decode(truncatedPayload)).toThrowError(/TRUNCATED|Length/);
  });

  it('Cross-Version Compatibility Rejection', () => {
    const block = createBaseBlock();
    block.events = [
      {
        sessionId: 'test_session',
        sequenceNumber: 1,
        requestId: 'req_1',
        requestedAt: 1100,
        completedAt: 1150,
        command: '010C',
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 50,
        rawFragments: [],
        rawText: '',
        frames: [],
        decodedReadings: [],
        negativeResponses: [],
        status: 'SUCCESS',
        warnings: []
      }
    ];
    block.eventCount = 1;
    block.lastEventSequence = 1;

    // V3 Encode
    const v3Encoded = codec.encode(block);

    // V2 Encode requires Obd2AcquisitionEvent[]
    const v2Encoded = v2Codec.encode([
      {
        requestSequence: 1,
        requestDelta: 100,
        outcome: 'VALUE',
        connectionState: 'CONNECTED',
        readings: []
      }
    ]);

    // V2 decoding V3 payload -> Should fail
    const v2Decoded = v2Codec.decode(v3Encoded.payload);
    expect(v2Decoded.errors.join(' ')).toMatch(/Invalid magic bytes/);

    // V3 decoding V2 payload -> Should fail
    expect(() => codec.decode(v2Encoded.payload as Uint8Array)).toThrowError(/Magic mismatch/);
  });
});
