export type DriverVoiceLanguage = 'en-US' | 'es-ES';

export const DEFAULT_DRIVER_VOICE_LANGUAGE: DriverVoiceLanguage = 'en-US';

export type DriverAlertKey =
  | 'ENGINE_HOT'
  | 'FIRE_RISK'
  | 'OIL_PRESSURE'
  | 'LOW_VOLTAGE'
  | 'TEMP_RISING'
  | 'CHECK_ENGINE'
  | 'SESSION_STOPPED';

type DriverAlertCopy = Record<DriverVoiceLanguage, string>;

/**
 * Controlled driving lexicon. Spoken alerts must stay short, recognizable,
 * and actionable. Detailed evidence belongs in the parked/review experience.
 *
 * FIRE_RISK is intentionally available as a vocabulary item only. It must not
 * be triggered from coolant temperature alone; a dedicated evidence rule is
 * required before that cue can be emitted.
 */
export const DRIVER_ALERT_LEXICON: Record<DriverAlertKey, DriverAlertCopy> = {
  ENGINE_HOT: {
    'en-US': 'STOP. ENGINE HOT.',
    'es-ES': 'ALTO. MOTOR CALIENTE.',
  },
  FIRE_RISK: {
    'en-US': 'STOP. FIRE RISK.',
    'es-ES': 'ALTO. RIESGO DE FUEGO.',
  },
  OIL_PRESSURE: {
    'en-US': 'STOP. OIL PRESSURE.',
    'es-ES': 'ALTO. PRESIÓN DE ACEITE.',
  },
  LOW_VOLTAGE: {
    'en-US': 'CHECK. LOW VOLTAGE.',
    'es-ES': 'REVISA. BAJO VOLTAJE.',
  },
  TEMP_RISING: {
    'en-US': 'CAUTION. TEMP RISING.',
    'es-ES': 'ATENCIÓN. TEMPERATURA SUBIENDO.',
  },
  CHECK_ENGINE: {
    'en-US': 'CHECK ENGINE.',
    'es-ES': 'REVISA MOTOR.',
  },
  SESSION_STOPPED: {
    'en-US': 'SESSION STOPPED.',
    'es-ES': 'SESIÓN DETENIDA.',
  },
};

export function resolveDriverAlertMessage(
  key: DriverAlertKey,
  language: DriverVoiceLanguage = DEFAULT_DRIVER_VOICE_LANGUAGE,
): string {
  return DRIVER_ALERT_LEXICON[key][language];
}
