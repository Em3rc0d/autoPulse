export type MotionState = 'PARKED' | 'MOVING' | 'UNKNOWN';

export type MotionEvidenceSource = 'ECU_SPEED' | 'PHONE_GNSS';

export interface MotionEvidence {
  source: MotionEvidenceSource;
  valueKmh: number;
  observedAt: number;
  quality: 'VALID' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE' | 'INVALID';
  decisionable: boolean;
}

export interface MotionPolicy {
  movingEnterKmh: number;
  parkedConfirmKmh: number;
  freshnessMs: number;
  movingConfirmMs: number;
  parkedConfirmMs: number;
}

export interface MotionStateSnapshot {
  state: MotionState;
  stateSince: number;
  reason: string;
  source?: MotionEvidenceSource;
  movingCandidateSince?: number;
  parkedCandidateSince?: number;
}

export const DEFAULT_MOTION_POLICY: MotionPolicy = {
  movingEnterKmh: 5,
  parkedConfirmKmh: 1,
  freshnessMs: 5_000,
  movingConfirmMs: 350,
  parkedConfirmMs: 1_200,
};

export function initialMotionState(nowMs: number): MotionStateSnapshot {
  return { state: 'UNKNOWN', stateSince: nowMs, reason: 'AWAITING_MOTION_EVIDENCE' };
}

const isUsable = (evidence: MotionEvidence, nowMs: number, policy: MotionPolicy) =>
  evidence.decisionable &&
  evidence.quality === 'VALID' &&
  Number.isFinite(evidence.valueKmh) &&
  nowMs - evidence.observedAt <= policy.freshnessMs;

export function resolveMotionState(
  previous: MotionStateSnapshot,
  evidence: readonly MotionEvidence[],
  nowMs: number,
  policy: MotionPolicy = DEFAULT_MOTION_POLICY,
): MotionStateSnapshot {
  const usable = evidence.filter(item => isUsable(item, nowMs, policy));
  if (usable.length === 0) {
    return {
      state: 'UNKNOWN',
      stateSince: previous.state === 'UNKNOWN' ? previous.stateSince : nowMs,
      reason: 'MOTION_EVIDENCE_UNAVAILABLE',
    };
  }

  const moving = usable.filter(item => Math.abs(item.valueKmh) >= policy.movingEnterKmh);
  const parked = usable.filter(item => Math.abs(item.valueKmh) <= policy.parkedConfirmKmh);
  const conflict = moving.length > 0 && parked.length > 0;

  // A trusted moving source can never be overridden into PARKED by a conflicting source.
  if (moving.length > 0) {
    const candidateSince = previous.movingCandidateSince ?? nowMs;
    if (previous.state === 'MOVING' || nowMs - candidateSince >= policy.movingConfirmMs) {
      return {
        state: 'MOVING',
        stateSince: previous.state === 'MOVING' ? previous.stateSince : nowMs,
        reason: conflict ? 'MOVING_WITH_SOURCE_CONFLICT' : 'MOVING_CONFIRMED',
        source: moving[0].source,
      };
    }
    return {
      state: 'UNKNOWN',
      stateSince: previous.state === 'UNKNOWN' ? previous.stateSince : nowMs,
      reason: conflict ? 'MOVING_CANDIDATE_WITH_SOURCE_CONFLICT' : 'MOVING_CANDIDATE',
      source: moving[0].source,
      movingCandidateSince: candidateSince,
    };
  }

  // Only positive, sustained stop evidence may promote to PARKED.
  if (parked.length === usable.length) {
    const candidateSince = previous.parkedCandidateSince ?? nowMs;
    if (previous.state === 'PARKED' || nowMs - candidateSince >= policy.parkedConfirmMs) {
      return {
        state: 'PARKED',
        stateSince: previous.state === 'PARKED' ? previous.stateSince : nowMs,
        reason: 'PARKED_CONFIRMED',
        source: parked[0].source,
      };
    }

    // While a stop is being confirmed, keep a previously moving UI low-distraction.
    return {
      state: previous.state === 'MOVING' ? 'MOVING' : 'UNKNOWN',
      stateSince: previous.stateSince,
      reason: 'PARKED_CANDIDATE',
      source: parked[0].source,
      parkedCandidateSince: candidateSince,
    };
  }

  return {
    state: 'UNKNOWN',
    stateSince: previous.state === 'UNKNOWN' ? previous.stateSince : nowMs,
    reason: 'MOTION_EVIDENCE_INDETERMINATE',
  };
}
