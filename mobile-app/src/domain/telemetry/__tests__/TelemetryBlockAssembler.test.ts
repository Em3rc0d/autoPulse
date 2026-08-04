import { TelemetryBlockAssembler } from '../logic/TelemetryBlockAssembler';
import { ObdAcquisitionEvent } from '../models/ObdAcquisitionEvent';

describe('TelemetryBlockAssembler', () => {
  const SESSION_ID = 'sess_123';
  const START_TIME = 10000;

  const createEvent = (seq: number, completedAt: number, readingCount = 1): ObdAcquisitionEvent => {
    return {
      sessionId: SESSION_ID,
      sequenceNumber: seq,
      requestId: `req_${seq}`,
      requestedAt: completedAt - 50,
      completedAt,
      command: '010C',
      commandFamily: 'OBD',
      completionReason: 'PROMPT',
      latencyMs: 50,
      rawFragments: [],
      rawText: '...',
      frames: [],
      decodedReadings: Array(readingCount).fill({
        signalId: 'RPM',
        service: '01',
        pid: '0C',
        value: 1000,
        unit: 'RPM',
        rawBytes: [],
        origin: 'OBD2',
        quality: 'GOOD',
        sourceEcu: null,
        observedAt: completedAt
      }),
      negativeResponses: [],
      status: 'SUCCESS',
      warnings: []
    };
  };

  it('rejects events with invalid session', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME);
    const badEvent = createEvent(1, START_TIME + 100);
    badEvent.sessionId = 'wrong_sess';
    expect(() => assembler.append(badEvent)).toThrowError('SESSION_MISMATCH');
  });

  it('rejects events before recording started', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME);
    const badEvent = createEvent(1, START_TIME - 1);
    expect(() => assembler.append(badEvent)).toThrowError('EVENT_BEFORE_RECORDING_START');
  });

  it('rejects duplicate or regressive sequences', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME);
    assembler.append(createEvent(2, START_TIME + 100));

    expect(() => assembler.append(createEvent(2, START_TIME + 200))).toThrowError('DUPLICATE_EVENT_SEQUENCE');
    expect(() => assembler.append(createEvent(1, START_TIME + 300))).toThrowError('REGRESSIVE_EVENT_SEQUENCE');
  });

  it('rejects events after assembler is closed', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME);
    assembler.flush(START_TIME + 1000);
    expect(() => assembler.append(createEvent(1, START_TIME + 2000))).toThrowError('ASSEMBLER_CLOSED');
  });

  it('rejects late events belonging to an already emitted window', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME, 5000);

    // Event at 5.1s -> belongs to window 1. Window 0 is skipped but current window becomes 1.
    assembler.append(createEvent(1, START_TIME + 5100));

    // Event at 4.9s -> belongs to window 0, which is earlier than current window 1.
    expect(() => assembler.append(createEvent(2, START_TIME + 4900))).toThrowError('LATE_EVENT');
  });

  it('does not emit a block on the first event', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME, 5000);
    const emitted = assembler.append(createEvent(1, START_TIME + 100));
    expect(emitted).toHaveLength(0);
  });

  it('emits block when window boundary is crossed', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME, 5000);

    assembler.append(createEvent(1, START_TIME + 100));
    assembler.append(createEvent(2, START_TIME + 4999));

    // Next event crosses into window 1 (>= 5000ms offset)
    const emitted = assembler.append(createEvent(3, START_TIME + 5000));

    expect(emitted).toHaveLength(1);
    const block = emitted[0];
    expect(block.windowIndex).toBe(0);
    expect(block.startedAt).toBe(START_TIME);
    expect(block.endedAt).toBe(START_TIME + 5000);
    expect(block.isPartial).toBe(false);
    expect(block.eventCount).toBe(2);
    expect(block.firstEventSequence).toBe(1);
    expect(block.lastEventSequence).toBe(2);
  });

  it('emits final partial block on flush', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME, 5000);

    assembler.append(createEvent(1, START_TIME + 5100));
    assembler.append(createEvent(2, START_TIME + 6000));

    // Stop at 7300 ms (2300 ms into the 2nd window)
    const finalBlock = assembler.flush(START_TIME + 7300);

    expect(finalBlock).not.toBeNull();
    expect(finalBlock!.windowIndex).toBe(1);
    expect(finalBlock!.startedAt).toBe(START_TIME + 5000);
    expect(finalBlock!.endedAt).toBe(START_TIME + 7300);
    expect(finalBlock!.isPartial).toBe(true);
    expect(finalBlock!.eventCount).toBe(2);
  });

  it('returns null on flush if no events in current window', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME, 5000);
    const finalBlock = assembler.flush(START_TIME + 1000);
    expect(finalBlock).toBeNull();
  });

  it('calculates readingCount correctly', () => {
    const assembler = new TelemetryBlockAssembler(SESSION_ID, START_TIME, 5000);

    assembler.append(createEvent(1, START_TIME + 100, 1)); // 1 reading
    assembler.append(createEvent(2, START_TIME + 200, 0)); // NO DATA (0 readings)
    assembler.append(createEvent(3, START_TIME + 300, 2)); // 2 readings

    const block = assembler.flush(START_TIME + 1000);
    expect(block!.eventCount).toBe(3);
    expect(block!.readingCount).toBe(3);
  });

  it('handles the reference case exactly as requested', () => {
    // Reference case:
    // recordingStartedAt = 0
    // duration = 5000
    // event #1 at 100 ms: RPM
    // event #2 at 700 ms: Speed
    // event #3 at 1800 ms: Coolant
    // event #4 at 2600 ms: 0142 negative response (NO DATA, 0 readings)
    // event #5 at 5100 ms: RPM
    // flush at 7300 ms

    const assembler = new TelemetryBlockAssembler(SESSION_ID, 0, 5000);

    expect(assembler.append(createEvent(1, 100, 1))).toHaveLength(0);
    expect(assembler.append(createEvent(2, 700, 1))).toHaveLength(0);
    expect(assembler.append(createEvent(3, 1800, 1))).toHaveLength(0);
    expect(assembler.append(createEvent(4, 2600, 0))).toHaveLength(0);

    const emitted = assembler.append(createEvent(5, 5100, 1));
    expect(emitted).toHaveLength(1);

    const block0 = emitted[0];
    expect(block0.windowIndex).toBe(0);
    expect(block0.startedAt).toBe(0);
    expect(block0.endedAt).toBe(5000);
    expect(block0.eventCount).toBe(4);
    expect(block0.readingCount).toBe(3);
    expect(block0.isPartial).toBe(false);

    const block1 = assembler.flush(7300);
    expect(block1).not.toBeNull();
    expect(block1!.windowIndex).toBe(1);
    expect(block1!.startedAt).toBe(5000);
    expect(block1!.endedAt).toBe(7300);
    expect(block1!.eventCount).toBe(1);
    expect(block1!.readingCount).toBe(1);
    expect(block1!.isPartial).toBe(true);
  });
});
