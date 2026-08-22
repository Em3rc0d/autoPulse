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
  it('does not declare startup ready while diagnostics or cold-start observation are still running', () => {
    const diagnostic = resolveStartupAssessment({
      connected: true,
      criticalChecksComplete: true,
      diagnosticScanComplete: false,
      coldStartObservationComplete: false,
      startedAt: 0,
      now: 120000,
    });

    expect(diagnostic.phase).toBe('DIAGNOSTIC_SCAN');
    expect(diagnostic.canDriveLive).toBe(true);
    expect(diagnostic.canBrief).toBe(false);
    expect(diagnostic.scanInProgress).toBe(true);

    const coldStart = resolveStartupAssessment({
      connected: true,
      criticalChecksComplete: true,
      diagnosticScanComplete: true,
      coldStartObservationComplete: false,
      startedAt: 0,
      now: 180000,
    });

    expect(coldStart.phase).toBe('COLD_START_OBSERVATION');
    expect(coldStart.canBrief).toBe(false);
  });

  it('allows a real warning to interrupt before the full startup scan completes', () => {
    const state = resolveStartupAssessment({
      connected: true,
      criticalChecksComplete: false,
      diagnosticScanComplete: false,
      coldStartObservationComplete: false,
      startedAt: 0,
      now: 10000,
      advisories: [warning],
    });

    expect(state.phase).toBe('QUICK_CHECK');
    expect(state.criticalFindingPresent).toBe(true);
    expect(state.canBrief).toBe(true);
  });

  it('permits the normal startup briefing only after the scan and cold-start observation mature', () => {
    const state = resolveStartupAssessment({
      connected: true,
      criticalChecksComplete: true,
      diagnosticScanComplete: true,
      coldStartObservationComplete: true,
      startedAt: 0,
      now: 240000,
    });

    expect(state.phase).toBe('READY');
    expect(state.canBrief).toBe(true);
    expect(state.scanInProgress).toBe(false);
  });
});
