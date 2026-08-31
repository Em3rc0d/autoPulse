export type VoiceLanguage = 'en-US' | 'es-ES';

export type DriverAlertSeverity = 'S0_NORMAL' | 'S1_ADVISORY' | 'S2_ATTENTION' | 'S3_CRITICAL';

export type DriverAlertKey =
  | 'ENGINE_OK'
  | 'TEMP_RISING'
  | 'ENGINE_HOT'
  | 'CHECK_ENGINE'
  | 'LOW_VOLTAGE'
  | 'OIL_PRESSURE'
  | 'FIRE_RISK'
  | 'SIGNAL_LOST';

export interface DriverAlertDefinition {
  key: DriverAlertKey;
  severity: DriverAlertSeverity;
  icon: '●' | '▲' | '!';
  en: string;
  es: string;
}

export const DRIVER_ALERT_LEXICON: Record<DriverAlertKey, DriverAlertDefinition> = {
  ENGINE_OK: { key: 'ENGINE_OK', severity: 'S0_NORMAL', icon: '●', en: 'ENGINE OK.', es: 'MOTOR OK.' },
  TEMP_RISING: { key: 'TEMP_RISING', severity: 'S1_ADVISORY', icon: '▲', en: 'CAUTION. TEMP RISING.', es: 'ATENCIÓN. TEMPERATURA SUBIENDO.' },
  ENGINE_HOT: { key: 'ENGINE_HOT', severity: 'S3_CRITICAL', icon: '!', en: 'STOP. ENGINE HOT.', es: 'ALTO. MOTOR CALIENTE.' },
  CHECK_ENGINE: { key: 'CHECK_ENGINE', severity: 'S2_ATTENTION', icon: '▲', en: 'CHECK ENGINE.', es: 'REVISA MOTOR.' },
  LOW_VOLTAGE: { key: 'LOW_VOLTAGE', severity: 'S2_ATTENTION', icon: '▲', en: 'CHECK. LOW VOLTAGE.', es: 'REVISA. BAJO VOLTAJE.' },
  OIL_PRESSURE: { key: 'OIL_PRESSURE', severity: 'S3_CRITICAL', icon: '!', en: 'STOP. OIL PRESSURE.', es: 'ALTO. PRESIÓN DE ACEITE.' },
  FIRE_RISK: { key: 'FIRE_RISK', severity: 'S3_CRITICAL', icon: '!', en: 'STOP. FIRE RISK.', es: 'ALTO. RIESGO DE FUEGO.' },
  SIGNAL_LOST: { key: 'SIGNAL_LOST', severity: 'S1_ADVISORY', icon: '▲', en: 'SIGNAL LOST.', es: 'SEÑAL PERDIDA.' },
};

export function driverAlertPhrase(key: DriverAlertKey, language: VoiceLanguage): string {
  const alert = DRIVER_ALERT_LEXICON[key];
  return language === 'es-ES' ? alert.es : alert.en;
}

export function driverAlertSeverity(key: DriverAlertKey): DriverAlertSeverity {
  return DRIVER_ALERT_LEXICON[key].severity;
}
