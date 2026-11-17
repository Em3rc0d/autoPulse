import { resolveStartupAssessment, type DriverAdvisory } from '..';

const warning: DriverAdvisory = {
  id: 'p0302',
  severity: 'WARNING',
  title: 'Engine warning',
  shortMessage: 'Cylinder two misfire detected',
  voiceMessage: 'Cylinder two misfire detected.',
  confidence: 'HIGH',
  evidence: [{ kind: 'DTC', reference: 'P0302' }],
  startedAt: 1,
  cooldownMs: 60000,
};

describe('StartupAssessment', () => {
  it('does not declare startup ready without a verified OBD preflight and cold-start evidence', () => {
    const diagnostic = resolveStartupAssessment({
      connected: true,
      preflightReachabilityVerified: true,
      characterizationComplete: false,
      coldStartObservationComplete: false,
      startedAt: 0,
      now: 120000,
    });

    expect(diagnostic.phase).toBe('CHARACTERIZATION');
    expect(diagnostic.canDriveLive).toBe(true);
    expect(diagnostic.canBrief).toBe(false);
    expect(diagnostic.scanInProgress).toBe(true);

    const coldStart = resolveStartupAssessment({
      connected: true,
      preflightReachabilityVerified: true,
      characterizationComplete: true,
      coldStartObservationComplete: false,
      startedAt: 0,
      now: 180000,
    });

    expect(coldStart.phase).toBe('COLD_START_OBSERVATION');
    expect(coldStart.canBrief).toBe(false);
  });

  it('allows a warning before read-only characterization completes', () => {
    const state = resolveStartupAssessment({
      connected: true,
      preflightReachabilityVerified: false,
      characterizationComplete: false,
      coldStartObservationComplete: false,
      startedAt: 0,
      now: 10000,
      advisories: [warning],
    });

    expect(state.phase).toBe('QUICK_CHECK');
    expect(state.criticalFindingPresent).toBe(true);
    expect(state.canBrief).toBe(true);
  });

  it('permits the startup briefing only after verified read-only characterization and fresh cold-start evidence', () => {
    const state = resolveStartupAssessment({
      connected: true,
      preflightReachabilityVerified: true,
      characterizationComplete: true,
      coldStartObservationComplete: true,
      startedAt: 0,
      now: 240000,
    });

    expect(state.phase).toBe('READY');
    expect(state.canBrief).toBe(true);
    expect(state.scanInProgress).toBe(false);
  });
});
