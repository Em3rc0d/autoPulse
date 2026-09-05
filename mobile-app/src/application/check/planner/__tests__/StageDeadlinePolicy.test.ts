import { evaluateStageGate, StageDeadlinePolicy } from '../StageDeadlinePolicy';

const policy: StageDeadlinePolicy = {
  overallDeadlineMs: 1000,
  stageDeadlineMs: {
    CAPABILITY_DISCOVERY: 300,
    DTC_CORE: 500,
  },
  provenance: 'fixture',
};

describe('CHECK-MK5 StageDeadlinePolicy', () => {
  it('allows before both stage and overall deadlines', () => {
    expect(evaluateStageGate(policy, {
      stage: 'DTC_CORE', scanStartedAt: 0, stageStartedAt: 100, now: 200, cancelRequested: false,
    })).toEqual({ disposition: 'ALLOW', remainingMs: 400 });
  });

  it('blocks deterministically at the exact stage deadline', () => {
    expect(evaluateStageGate(policy, {
      stage: 'CAPABILITY_DISCOVERY', scanStartedAt: 0, stageStartedAt: 100, now: 400, cancelRequested: false,
    })).toEqual({ disposition: 'BLOCK', reason: 'STAGE_DEADLINE_EXCEEDED', remainingMs: 0 });
  });

  it('blocks at the overall deadline even if stage time remains', () => {
    expect(evaluateStageGate(policy, {
      stage: 'DTC_CORE', scanStartedAt: 0, stageStartedAt: 700, now: 1000, cancelRequested: false,
    })).toEqual({ disposition: 'BLOCK', reason: 'OVERALL_DEADLINE_EXCEEDED', remainingMs: 0 });
  });

  it('cancellation wins before any new request can be admitted', () => {
    expect(evaluateStageGate(policy, {
      stage: 'DTC_CORE', scanStartedAt: 0, stageStartedAt: 10, now: 20, cancelRequested: true,
    })).toEqual({ disposition: 'BLOCK', reason: 'CANCELLED', remainingMs: 0 });
  });

  it('rejects non-monotonic timestamps instead of guessing', () => {
    expect(() => evaluateStageGate(policy, {
      stage: 'DTC_CORE', scanStartedAt: 100, stageStartedAt: 50, now: 200, cancelRequested: false,
    })).toThrow('not monotonic');
  });
});
