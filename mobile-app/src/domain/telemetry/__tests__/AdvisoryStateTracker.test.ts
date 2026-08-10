import { SignalSessionStatsTracker, SignalQualityEvaluator, AdvisoryStateTracker } from '../AdvisoryStateTracker';
import { DEMO_PROFILES } from '../SignalProfiles';
import { DataQuality, SignalAdvisoryProfile } from '../SignalAdvisory';

describe('SignalQualityEvaluator', () => {
  it('identifies STALE when timeout passed', () => {
    expect(SignalQualityEvaluator.evaluate(100, null, 'RPM', 1000, 2000, 300)).toBe('STALE');
  });

  it('identifies SUSPECT for coolant protocol floor', () => {
    expect(SignalQualityEvaluator.evaluate(-40, null, 'ENGINE_COOLANT', 1000, 1000, 300)).toBe('SUSPECT');
  });

  it('preserves explicit INVALID', () => {
    expect(SignalQualityEvaluator.evaluate(100, 'INVALID', 'RPM', 1000, 1000, 300)).toBe('INVALID');
  });
});

describe('SignalSessionStatsTracker', () => {
  it('does not update min for RPM=0 (engine stopped)', () => {
    const tracker = new SignalSessionStatsTracker();
    tracker.record(0, 'VALID', 'ENGINE_RPM');
    expect(tracker.getStats().validMinObserved).toBeNull();
    expect(tracker.getStats().engineStoppedObserved).toBe(true);
  });

  it('updates min for valid Speed=0', () => {
    const tracker = new SignalSessionStatsTracker();
    tracker.record(0, 'VALID', 'VEHICLE_SPEED');
    expect(tracker.getStats().validMinObserved).toBe(0);
  });

  it('ignores SUSPECT and STALE values for stats min/max/average', () => {
    const tracker = new SignalSessionStatsTracker();
    tracker.record(-40, 'SUSPECT', 'ENGINE_COOLANT');
    tracker.record(90, 'STALE', 'ENGINE_COOLANT');
    expect(tracker.getStats().validMinObserved).toBeNull();
    expect(tracker.getStats().validAverage).toBeNull();
    expect(tracker.getStats().suspectValuesObserved).toBe(true);
  });

  it('first VALID RPM sets both min and max', () => {
    const tracker = new SignalSessionStatsTracker();
    tracker.record(782, 'VALID', 'ENGINE_RPM');
    expect(tracker.getStats().validMinObserved).toBe(782);
    expect(tracker.getStats().validMaxObserved).toBe(782);
  });

  it('calculates average correctly from valid samples only', () => {
    const tracker = new SignalSessionStatsTracker();
    tracker.record(800, 'VALID', 'ENGINE_RPM');
    tracker.record(1200, 'VALID', 'ENGINE_RPM');
    tracker.record(900, 'UNAVAILABLE', 'ENGINE_RPM'); // Should be ignored
    tracker.record(1000, 'VALID', 'ENGINE_RPM');
    
    const stats = tracker.getStats();
    expect(stats.validReadingCount).toBe(3);
    expect(stats.validSum).toBe(3000);
    expect(stats.validAverage).toBe(1000); // 3000 / 3
  });

  it('retains session peak (MAX) even after subsequent lower readings', () => {
    const tracker = new SignalSessionStatsTracker();
    tracker.record(800, 'VALID', 'ENGINE_RPM');
    tracker.record(4800, 'VALID', 'ENGINE_RPM'); // The peak
    tracker.record(900, 'VALID', 'ENGINE_RPM');
    
    const stats = tracker.getStats();
    expect(stats.validMaxObserved).toBe(4800);
  });
});

describe('AdvisoryStateTracker', () => {
  let mockClock: number = 1000;
  const clock = () => mockClock;

  it('RPM without speed context still uses base advisory bands', () => {
    const tracker = new AdvisoryStateTracker(DEMO_PROFILES.ENGINE_RPM, clock);
    const state = tracker.evaluate(2500, 'VALID');
    expect(state.advisory).toBe('NORMAL');
    expect(state.color).toBe('GREEN');
  });

  it('Speed without configured limit remains neutral', () => {
    const tracker = new AdvisoryStateTracker(DEMO_PROFILES.VEHICLE_SPEED, clock);
    const state = tracker.evaluate(120, 'VALID');
    expect(state.advisory).toBe('NORMAL');
    expect(state.color).toBe('GREEN');
  });

  it('Coolant uses hysteresis correctly', () => {
    const profile = { ...DEMO_PROFILES.ENGINE_COOLANT, hysteresisMs: 1000, sustainDurationMs: 2000 };
    const tracker = new AdvisoryStateTracker(profile, clock);

    // Initial state is NORMAL
    mockClock = 1000;
    tracker.evaluate(95, 'VALID');

    // Spike to 106 (ELEVATED), but wait only 500ms
    mockClock = 1500;
    let state = tracker.evaluate(106, 'VALID');
    expect(state.advisory).toBe('NORMAL'); // Still normal because sustainDurationMs is 2000

    // Spike continues to 3600 (1500 + 2000 = 3500 required)
    mockClock = 3600;
    state = tracker.evaluate(106, 'VALID');
    expect(state.advisory).toBe('ELEVATED');
  });

  it('UNAVAILABLE produces GRAY card', () => {
    const tracker = new AdvisoryStateTracker(DEMO_PROFILES.CONTROL_MODULE_VOLTAGE, clock);
    const state = tracker.evaluate(0, 'UNAVAILABLE');
    expect(state.color).toBe('GRAY');
    expect(state.quality).toBe('UNAVAILABLE');
  });

  it('critical readings do not stay gray after an UNKNOWN state', () => {
    const tracker = new AdvisoryStateTracker(DEMO_PROFILES.ENGINE_COOLANT, clock);
    tracker.evaluate(0, 'UNAVAILABLE');

    const state = tracker.evaluate(116, 'VALID');
    expect(state.advisory).toBe('CRITICAL');
    expect(state.color).toBe('RED');
  });
});
