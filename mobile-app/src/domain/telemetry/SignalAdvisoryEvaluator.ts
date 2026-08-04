import {
  SignalAdvisoryState,
  SignalAdvisoryProfile,
  DataQuality,
  SignalAdvisoryStatus
} from './SignalAdvisory';

export class SignalAdvisoryEvaluator {
  private static determineQuality(value: number | string | null | undefined): DataQuality {
    if (value === null || value === undefined || value === 'NO_DATA') return 'UNAVAILABLE';
    return 'VALID';
  }

  public static evaluate(
    value: number | null,
    profile: SignalAdvisoryProfile
  ): SignalAdvisoryState {
    const quality = this.determineQuality(value);

    // If quality is bad, it's GRAY regardless of mechanical state
    if (quality !== 'VALID' || value === null) {
      return {
        quality,
        advisory: 'UNKNOWN',
        calibration: profile.calibrationStatus,
        source: profile.sourceType,
        color: 'GRAY',
        badgeText: 'Dato no disponible'
      };
    }

    // Determine mechanical state based on bands
    let advisory: SignalAdvisoryStatus = 'UNKNOWN';
    for (const band of profile.bands) {
      const min = band.min ?? -Infinity;
      const max = band.max ?? Infinity;
      if (value >= min && value <= max) {
        advisory = band.status;
        break;
      }
    }

    // Determine color from advisory
    let color: SignalAdvisoryState['color'] = 'NEUTRAL';
    if (advisory === 'COLD' || advisory === 'WARMING') color = 'BLUE';
    else if (advisory === 'NORMAL') color = 'GREEN';
    else if (advisory === 'ELEVATED') color = 'ORANGE';
    else if (advisory === 'CRITICAL') color = 'RED';

    // Determine badge text
    let badgeText = '';
    if (profile.calibrationStatus === 'NOT_CALIBRATED') {
      badgeText = 'No configurado';
    } else if (profile.calibrationStatus === 'GENERIC_ONLY') {
      badgeText = 'Referencia general';
    } else {
      badgeText = 'Perfil validado';
    }

    return {
      quality,
      advisory,
      calibration: profile.calibrationStatus,
      source: profile.sourceType,
      color,
      badgeText
    };
  }
}
