import {
  flightRecorder,
  MAX_FLIGHT_RECORDER_EVENTS,
} from '../FlightRecorder';

describe('FlightRecorder', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    flightRecorder.clear();
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('records ordered structured events and mirrors them to console', () => {
    const first = flightRecorder.record({
      category: 'SESSION',
      event: 'START',
      sessionId: 's1',
      timestampMs: 100,
      details: { state: 'ACTIVE' },
    });
    const second = flightRecorder.record({
      category: 'PERSISTENCE',
      event: 'COMMIT_FAILED',
      sessionId: 's1',
      timestampMs: 200,
      details: { reason: 'DATABASE_WRITE_FAILED' },
    });

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(flightRecorder.snapshot()).toHaveLength(2);
    expect(log).toHaveBeenCalledTimes(2);
    expect(String(log.mock.calls[0][0])).toContain('[AUTOPULSE_TRACE]');
  });

  it('redacts sensitive keys and normalizes unsafe numeric values', () => {
    const entry = flightRecorder.record({
      category: 'OBD_TRANSPORT',
      event: 'FAILURE',
      details: {
        command: '010C',
        rawResponseText: '41 0C 0C 80',
        vin: 'PRIVATE',
        latencyMs: Number.NaN,
      },
    });

    expect(entry.details.command).toBe('010C');
    expect(entry.details.rawResponseText).toBe('[REDACTED]');
    expect(entry.details.vin).toBe('[REDACTED]');
    expect(entry.details.latencyMs).toBeNull();
  });

  it('keeps a bounded ring buffer', () => {
    for (let i = 0; i < MAX_FLIGHT_RECORDER_EVENTS + 10; i += 1) {
      flightRecorder.record({
        category: 'SESSION',
        event: 'TICK',
        timestampMs: i,
        details: { i },
      });
    }

    const snapshot = flightRecorder.snapshot();
    expect(snapshot).toHaveLength(MAX_FLIGHT_RECORDER_EVENTS);
    expect(snapshot[0].sequence).toBe(11);
  });

  it('returns defensive snapshots', () => {
    flightRecorder.record({ category: 'SESSION', event: 'START' });
    const first = flightRecorder.snapshot();
    const second = flightRecorder.snapshot();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0]).toEqual(second[0]);
  });
});
