export interface StartupSignalObservation {
  value: number;
  firstValue: number;
  firstObservedAt: number;
  observedAt: number;
  sampleCount: number;
  quality: 'VALID' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE' | 'INVALID';
}

export interface ColdStartMaturityInput {
  rpm?: StartupSignalObservation;
  coolant?: StartupSignalObservation;
  nowMs: number;
}

export interface ColdStartMaturity {
  complete: boolean;
  kind: 'COLD' | 'WARM' | 'UNRESOLVED';
  reason:
    | 'CORE_SIGNALS_MISSING'
    | 'INSUFFICIENT_SAMPLES'
    | 'WARM_START_STABLE'
    | 'COLD_START_WARMING_OBSERVED'
    | 'COLD_START_OBSERVATION_WINDOW_COMPLETE';
}

const usable = (observation?: StartupSignalObservation) =>
  Boolean(observation && (observation.quality === 'VALID' || observation.quality === 'DEGRADED'));

/**
 * Evidence-based startup maturity, not a fixed sleep timer.
 * A clearly cold engine is observed longer so AutoPulse can see warm-up behavior.
 * A warm restart only needs a short stable sample window. Missing core evidence
 * never becomes a false "ready" state.
 */
export function resolveColdStartMaturity(input: ColdStartMaturityInput): ColdStartMaturity {
  if (!usable(input.rpm) || !usable(input.coolant)) {
    return { complete: false, kind: 'UNRESOLVED', reason: 'CORE_SIGNALS_MISSING' };
  }

  const rpm = input.rpm!;
  const coolant = input.coolant!;
  const firstObservedAt = Math.min(rpm.firstObservedAt, coolant.firstObservedAt);
  const elapsedMs = Math.max(0, input.nowMs - firstObservedAt);
  const minimumSamples = Math.min(rpm.sampleCount, coolant.sampleCount);
  const coldStart = coolant.firstValue < 70;

  if (!coldStart) {
    const complete = minimumSamples >= 5 && elapsedMs >= 10_000;
    return complete
      ? { complete: true, kind: 'WARM', reason: 'WARM_START_STABLE' }
      : { complete: false, kind: 'WARM', reason: 'INSUFFICIENT_SAMPLES' };
  }

  const coolantRise = coolant.value - coolant.firstValue;
  if (minimumSamples >= 10 && elapsedMs >= 30_000 && (coolantRise >= 3 || coolant.value >= 70)) {
    return { complete: true, kind: 'COLD', reason: 'COLD_START_WARMING_OBSERVED' };
  }

  // Some engines warm very slowly at idle. A sufficiently long, valid observation
  // window is accepted without inventing a temperature trend that did not occur.
  if (minimumSamples >= 20 && elapsedMs >= 180_000) {
    return { complete: true, kind: 'COLD', reason: 'COLD_START_OBSERVATION_WINDOW_COMPLETE' };
  }

  return { complete: false, kind: 'COLD', reason: 'INSUFFICIENT_SAMPLES' };
}
