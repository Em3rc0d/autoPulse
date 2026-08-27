import { buildAutoPulseCheckPlan } from '../AutoPulseCheckPlan';

describe('AutoPulseCheckPlan', () => {
  it('keeps unsupported capabilities explicit instead of silently claiming coverage', () => {
    const plan = buildAutoPulseCheckPlan('PRE_PURCHASE', {
      obd: 'SUPPORTED',
      dtcRead: 'SUPPORTED',
      readiness: 'UNKNOWN',
      freezeFrame: 'UNSUPPORTED',
      liveTelemetry: 'SUPPORTED',
      availableSignals: ['RPM', 'SPEED', 'COOLANT'],
    });

    expect(plan.steps.find(step => step.id === 'DTC_SCAN')?.availability).toBe('AVAILABLE');
    expect(plan.steps.find(step => step.id === 'READINESS_SCAN')?.availability).toBe('UNKNOWN');
    expect(plan.steps.find(step => step.id === 'FREEZE_FRAME')?.availability).toBe('UNAVAILABLE');
    expect(plan.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('Readiness'),
      expect.stringContaining('Freeze-frame'),
    ]));
  });

  it('requires a road evidence window for pre-purchase checks', () => {
    const plan = buildAutoPulseCheckPlan('PRE_PURCHASE', {
      obd: 'SUPPORTED',
      dtcRead: 'SUPPORTED',
      readiness: 'SUPPORTED',
      freezeFrame: 'SUPPORTED',
      liveTelemetry: 'SUPPORTED',
    });

    const road = plan.steps.find(step => step.id === 'ROAD_TELEMETRY');
    expect(road?.mandatory).toBe(true);
    expect(road?.availability).toBe('AVAILABLE');
  });

  it('does not pretend freeze frame always exists even when the capability is supported', () => {
    const plan = buildAutoPulseCheckPlan('PREVENTIVE', {
      obd: 'SUPPORTED',
      dtcRead: 'SUPPORTED',
      readiness: 'SUPPORTED',
      freezeFrame: 'SUPPORTED',
      liveTelemetry: 'SUPPORTED',
    });

    expect(plan.steps.find(step => step.id === 'FREEZE_FRAME')?.availability).toBe('CONDITIONAL');
  });
});
