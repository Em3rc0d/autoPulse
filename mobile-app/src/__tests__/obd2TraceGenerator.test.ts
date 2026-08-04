import { Obd2TelemetryGenerator, Obd2BenchmarkConfig } from '../infrastructure/database/benchmark/Obd2TelemetryGenerator';
import { Obd2AcquisitionEvent } from '../infrastructure/database/benchmark/PayloadAdapter';

describe('Obd2TelemetryGenerator OBD2 v2', () => {
  it('should generate deterministic traces given a seed', () => {
    const config: Obd2BenchmarkConfig = {
      seed: 12345,
      runId: 'test',
      profile: 'BASELINE',
      blockDurationMs: 5000,
      durationMs: 1000 // Just run for 1 sec
    };

    const eventsA: Obd2AcquisitionEvent[] = [];
    const eventsB: Obd2AcquisitionEvent[] = [];

    let completedA = false;
    let completedB = false;

    // We can't really test setTimeout determinism perfectly in a standard Jest environment without fake timers,
    // but we can mock setTimeout or use Jest fake timers to advance time and ensure identical execution.
    jest.useFakeTimers();

    const genA = new Obd2TelemetryGenerator(
      config,
      e => eventsA.push(e),
      () => { completedA = true; }
    );

    const genB = new Obd2TelemetryGenerator(
      config,
      e => eventsB.push(e),
      () => { completedB = true; }
    );

    genA.start();
    jest.runAllTimers();
    expect(completedA).toBe(true);

    genB.start();
    jest.runAllTimers();
    expect(completedB).toBe(true);

    expect(eventsA.length).toBeGreaterThan(0);
    expect(eventsA.length).toEqual(eventsB.length);

    for (let i = 0; i < eventsA.length; i++) {
      expect(eventsA[i].outcome).toEqual(eventsB[i].outcome);
      expect(eventsA[i].requestDelta).toEqual(eventsB[i].requestDelta);
      if (eventsA[i].outcome === 'VALUE') {
        expect(eventsA[i].readings[0].normalizedValue).toBeCloseTo(eventsB[i].readings[0].normalizedValue, 4);
      }
    }

    jest.useRealTimers();
  });
});
