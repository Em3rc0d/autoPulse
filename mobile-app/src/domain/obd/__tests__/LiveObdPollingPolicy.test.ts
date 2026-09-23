import {
  LIVE_OBD_REQUEST_ORDER,
  resolveLivePollingPlan,
  withProvenAdapterVoltage,
} from '../LiveObdPollingPolicy';

describe('LiveObdPollingPolicy', () => {
  it('keeps only signals consumed by Driving View v2 and restores policy order', () => {
    const plan = resolveLivePollingPlan(['0111', '010B', '010C', 'FFFF', '0105']);
    expect(plan).toEqual({
      requestIds: ['0105', '010C', '0111'],
      fallbackProbe: false,
    });
  });

  it('uses a bounded evidence-seeking fallback when discovery has no live signal', () => {
    const plan = resolveLivePollingPlan(['010B', '0110']);
    expect(plan.fallbackProbe).toBe(true);
    expect(plan.requestIds).toEqual([...LIVE_OBD_REQUEST_ORDER]);
  });

  it('normalizes request casing and whitespace', () => {
    expect(resolveLivePollingPlan([' 010c ', '010d'])).toEqual({
      requestIds: ['010D', '010C'],
      fallbackProbe: false,
    });
  });

  it('adds ATRV only after capability proof and never duplicates it', () => {
    expect(withProvenAdapterVoltage(['0105', '010C'], false)).toEqual(['0105', '010C']);
    expect(withProvenAdapterVoltage(['0105', '010C'], true)).toEqual(['0105', '010C', 'ATRV']);
    expect(withProvenAdapterVoltage(['0105', 'atrv'], true)).toEqual(['0105', 'ATRV']);
  });
});
