import { SignalAdvisoryProfile, SignalAdvisoryStatus, AdvisoryContext } from './SignalAdvisory';

export class ContextualAdvisoryEvaluator {
  public static evaluateCandidate(
    value: number,
    profile: SignalAdvisoryProfile,
    context?: AdvisoryContext
  ): SignalAdvisoryStatus {
    const signalId = profile?.signalId;

    if (signalId === 'ENGINE_RPM') {
      return this.evaluateRpm(value, profile, context);
    }
    if (signalId === 'CONTROL_MODULE_VOLTAGE') {
      return this.evaluateVoltage(value, profile, context);
    }

    // Default static band evaluation
    return this.evaluateStaticBands(value, profile?.bands);
  }

  private static evaluateStaticBands(value: number, bands: any[] = []): SignalAdvisoryStatus {
    for (const band of bands) {
      const min = band.min ?? -Infinity;
      const max = band.max ?? Infinity;
      if (value >= min && value <= max) {
        return band.status;
      }
    }
    return 'UNKNOWN';
  }

  private static evaluateRpm(
    value: number,
    profile: SignalAdvisoryProfile,
    context?: AdvisoryContext
  ): SignalAdvisoryStatus {
    const speedCtx = context?.speed;
    const isStopped = speedCtx?.quality === 'VALID' && speedCtx.value === 0;

    if (value === 0) return 'UNKNOWN';
    if (value > 4000) return 'ELEVATED';

    if (isStopped) {
      if (value >= 1 && value <= 599) return 'ELEVATED';
      if (value >= 600 && value <= 900) return 'NORMAL';
      if (value >= 901 && value <= 1200) return 'WARMING';
      return 'ELEVATED';
    }

    if (value >= 1 && value <= 599) return 'ELEVATED';
    if (value >= 600 && value <= 1200) return 'NORMAL';
    if (value >= 1201 && value <= 4000) return 'NORMAL';

    return 'ELEVATED';
  }

  private static evaluateVoltage(
    value: number,
    profile: SignalAdvisoryProfile,
    context?: AdvisoryContext
  ): SignalAdvisoryStatus {
    const rpmCtx = context?.rpm;

    const hasRpmContext = rpmCtx?.quality === 'VALID' && rpmCtx.value !== null;
    const isEngineRunning = hasRpmContext ? (rpmCtx.value as number) > 0 : value >= 13.2;

    if (isEngineRunning) {
      if (value >= 13.7 && value <= 14.7) return 'NORMAL';
      if (value >= 13.5 && value < 13.7) return 'ELEVATED';
      if (value > 14.7 && value <= 15.0) return 'ELEVATED';
      if (value < 13.5) return 'CRITICAL';
      if (value > 15.0) return 'CRITICAL';
    } else {
      if (value >= 12.6 && value <= 12.8) return 'NORMAL';
      if (value >= 12.4 && value < 12.6) return 'ELEVATED';
      if (value >= 12.0 && value < 12.4) return 'ELEVATED';
      if (value < 12.0) return 'CRITICAL';
      if (value > 12.8) return 'UNKNOWN';
    }

    return 'UNKNOWN';
  }
}
