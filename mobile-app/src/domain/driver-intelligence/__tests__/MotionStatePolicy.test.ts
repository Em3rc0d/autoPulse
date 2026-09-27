import {
  DEFAULT_MOTION_POLICY,
  initialMotionState,
  resolveMotionState,
  type MotionEvidence,
} from '../MotionStatePolicy';

const ecu = (valueKmh: number, observedAt: number, quality: MotionEvidence['quality'] = 'VALID'): MotionEvidence => ({
  source: 'ECU_SPEED',
  valueKmh,
  observedAt,
  quality,
  decisionable: true,
});

describe('MotionStatePolicy', () => {
  it('starts UNKNOWN and never treats missing evidence as PARKED', () => {
    const initial = initialMotionState(1_000);
    expect(initial.state).toBe('UNKNOWN');
    expect(resolveMotionState(initial, [], 2_000).state).toBe('UNKNOWN');
  });

  it('confirms movement after the moving window', () => {
    const initial = initialMotionState(1_000);
    const candidate = resolveMotionState(initial, [ecu(12, 1_100)], 1_100);
    expect(candidate.state).toBe('UNKNOWN');
    const moving = resolveMotionState(candidate, [ecu(12, 1_500)], 1_500);
    expect(moving.state).toBe('MOVING');
  });

  it('moves to UNKNOWN when speed becomes stale instead of PARKED', () => {
    const moving = {
      ...initialMotionState(1_000),
      state: 'MOVING' as const,
      stateSince: 1_000,
    };
    const next = resolveMotionState(
      moving,
      [ecu(30, 1_000)],
      1_000 + DEFAULT_MOTION_POLICY.freshnessMs + 1,
    );
    expect(next.state).toBe('UNKNOWN');
  });

  it('requires sustained positive stop evidence before PARKED', () => {
    const initial = initialMotionState(1_000);
    const candidate = resolveMotionState(initial, [ecu(0, 1_100)], 1_100);
    expect(candidate.state).toBe('UNKNOWN');
    const parked = resolveMotionState(candidate, [ecu(0, 2_400)], 2_400);
    expect(parked.state).toBe('PARKED');
  });

  it('never promotes PARKED while another trusted source indicates movement', () => {
    const initial = initialMotionState(1_000);
    const evidence: MotionEvidence[] = [
      ecu(0, 1_100),
      { source: 'PHONE_GNSS', valueKmh: 22, observedAt: 1_100, quality: 'VALID', decisionable: true },
    ];
    const candidate = resolveMotionState(initial, evidence, 1_100);
    const next = resolveMotionState(candidate, evidence.map(item => ({ ...item, observedAt: 1_500 })), 1_500);
    expect(next.state).toBe('MOVING');
    expect(next.reason).toContain('CONFLICT');
  });
});
