import { DataQuality, SignalAdvisoryStatus, SignalAdvisoryState, SignalAdvisoryProfile, SignalSessionStats, AdvisoryContext } from './SignalAdvisory';
import { ContextualAdvisoryEvaluator } from './ContextualAdvisoryEvaluator';
export class SignalQualityEvaluator {
  public static evaluate(
    value: number | null | undefined,
    explicitQuality: DataQuality | null,
    signalId: string,
    lastValidObservedAt: number | null,
    now: number,
    expectedPollIntervalMs: number
  ): DataQuality {
    if (explicitQuality === 'INVALID' || explicitQuality === 'UNAVAILABLE' || explicitQuality === 'DEGRADED') {
      return explicitQuality;
    }

    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'UNAVAILABLE';
    }

    if (signalId === 'ENGINE_COOLANT' && value === -40) {
      return 'SUSPECT'; // Protocol floor
    }

    const staleAfterMs = expectedPollIntervalMs * 3;
    if (lastValidObservedAt && (now - lastValidObservedAt) > staleAfterMs) {
      return 'STALE';
    }

    return 'VALID';
  }
}

export class SignalSessionStatsTracker {
  private stats: SignalSessionStats = {
    validReadingCount: 0,
    validMinObserved: null,
    validMaxObserved: null,
    engineStoppedObserved: false,
    suspectValuesObserved: false
  };

  public getStats(): SignalSessionStats {
    return { ...this.stats };
  }

  public reset() {
    this.stats = {
      validReadingCount: 0,
      validMinObserved: null,
      validMaxObserved: null,
      engineStoppedObserved: false,
      suspectValuesObserved: false
    };
  }

  public record(value: number, quality: DataQuality, signalId: string) {
    if (signalId === 'ENGINE_COOLANT' && quality === 'SUSPECT') {
      this.stats.suspectValuesObserved = true;
      return;
    }

    if (signalId === 'ENGINE_RPM' && value === 0 && quality === 'VALID') {
      this.stats.engineStoppedObserved = true;
      // 0 RPM is valid but doesn't change operating min
      this.stats.validReadingCount += 1;
      if (this.stats.validMaxObserved === null || value > this.stats.validMaxObserved) {
        this.stats.validMaxObserved = value;
      }
      return;
    }

    if (quality !== 'VALID') return;

    this.stats.validReadingCount += 1;

    if (this.stats.validMinObserved === null || value < this.stats.validMinObserved) {
      this.stats.validMinObserved = value;
    }
    if (this.stats.validMaxObserved === null || value > this.stats.validMaxObserved) {
      this.stats.validMaxObserved = value;
    }
  }
}

export class AdvisoryStateTracker {
  private lastCandidate: SignalAdvisoryStatus = 'UNKNOWN';
  private candidateSince: number | null = null;
  private confirmedState: SignalAdvisoryStatus | null = null;

  constructor(private profile: SignalAdvisoryProfile, private clock: () => number = Date.now) {}

  public evaluate(value: number, quality: DataQuality, context?: AdvisoryContext): SignalAdvisoryState {
    let candidate: SignalAdvisoryStatus = 'UNKNOWN';
    let color: SignalAdvisoryState['color'] = 'GRAY';

    if (quality === 'VALID' || quality === 'DEGRADED') {
      candidate = ContextualAdvisoryEvaluator.evaluateCandidate(value, this.profile, context);
    }

    const now = this.clock();

    if (candidate !== this.lastCandidate) {
      this.lastCandidate = candidate;
      this.candidateSince = now;
    }

    let delayMs = 0;
    if (candidate === 'ELEVATED') delayMs = this.profile.sustainDurationMs || 3000;
    else if (candidate === 'CRITICAL') delayMs = 2000;
    else if (candidate === 'NORMAL') delayMs = this.profile.hysteresisMs || 3000;

    if (this.confirmedState === null || this.confirmedState === 'UNKNOWN' || candidate === 'CRITICAL') {
      this.confirmedState = candidate;
    } else if (this.candidateSince !== null && (now - this.candidateSince) >= delayMs) {
      this.confirmedState = candidate;
    }

    if (quality === 'VALID' || quality === 'DEGRADED') {
      if (this.confirmedState === 'COLD' || this.confirmedState === 'WARMING') color = 'BLUE';
      else if (this.confirmedState === 'NORMAL') color = 'GREEN';
      else if (this.confirmedState === 'ELEVATED') color = 'ORANGE';
      else if (this.confirmedState === 'CRITICAL') color = 'RED';
      else color = 'NEUTRAL';
    }

    let badgeText = '';

    if (quality === 'UNAVAILABLE' || quality === 'INVALID') badgeText = 'NO DATA';
    else if (quality === 'STALE') badgeText = 'STALE';
    else if (quality === 'SUSPECT') badgeText = 'SUSPECT';
    else if (quality === 'DEGRADED') badgeText = 'DEGRADED';
    else if (this.profile.calibrationStatus === 'OEM_CALIBRATED') badgeText = 'OEM';
    else if (this.profile.calibrationStatus === 'VEHICLE_CALIBRATED') badgeText = 'CALIBRATED';

    return {
      quality,
      advisory: this.confirmedState || 'UNKNOWN',
      calibration: this.profile.calibrationStatus,
      source: this.profile.sourceType,
      color,
      badgeText
    };
  }
}