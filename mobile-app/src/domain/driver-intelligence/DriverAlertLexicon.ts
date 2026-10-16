import { uiMessage } from '../../application/localization/UiCatalog';

export type VoiceLanguage = 'en-US' | 'es-ES';

export type DriverAlertSeverity = 'S0_NORMAL' | 'S1_ADVISORY' | 'S2_ATTENTION' | 'S3_CRITICAL';

export type DriverAlertKey =
  | 'AUTOPULSE_READY'
  | 'ENGINE_OK'
  | 'TEMP_RISING'
  | 'ENGINE_HOT'
  | 'CHECK_ENGINE'
  | 'LOW_VOLTAGE'
  | 'OIL_PRESSURE'
  | 'FIRE_RISK'
  | 'SIGNAL_LOST'
  | 'SESSION_INTERRUPTED';

export interface DriverAlertDefinition {
  key: DriverAlertKey;
  severity: DriverAlertSeverity;
  icon: '●' | '▲' | '!';
  en: string;
  es: string;
}

export const DRIVER_ALERT_LEXICON: Record<DriverAlertKey, DriverAlertDefinition> = {
  AUTOPULSE_READY: { key: 'AUTOPULSE_READY', severity: 'S0_NORMAL', icon: '●', en: uiMessage('voice.AUTOPULSE_READY', 'en-US'), es: uiMessage('voice.AUTOPULSE_READY', 'es-ES') },
  ENGINE_OK: { key: 'ENGINE_OK', severity: 'S0_NORMAL', icon: '●', en: uiMessage('voice.ENGINE_OK', 'en-US'), es: uiMessage('voice.ENGINE_OK', 'es-ES') },
  TEMP_RISING: { key: 'TEMP_RISING', severity: 'S1_ADVISORY', icon: '▲', en: uiMessage('voice.TEMP_RISING', 'en-US'), es: uiMessage('voice.TEMP_RISING', 'es-ES') },
  ENGINE_HOT: { key: 'ENGINE_HOT', severity: 'S3_CRITICAL', icon: '!', en: uiMessage('voice.ENGINE_HOT', 'en-US'), es: uiMessage('voice.ENGINE_HOT', 'es-ES') },
  CHECK_ENGINE: { key: 'CHECK_ENGINE', severity: 'S2_ATTENTION', icon: '▲', en: uiMessage('voice.CHECK_ENGINE', 'en-US'), es: uiMessage('voice.CHECK_ENGINE', 'es-ES') },
  LOW_VOLTAGE: { key: 'LOW_VOLTAGE', severity: 'S2_ATTENTION', icon: '▲', en: uiMessage('voice.LOW_VOLTAGE', 'en-US'), es: uiMessage('voice.LOW_VOLTAGE', 'es-ES') },
  OIL_PRESSURE: { key: 'OIL_PRESSURE', severity: 'S3_CRITICAL', icon: '!', en: uiMessage('voice.OIL_PRESSURE', 'en-US'), es: uiMessage('voice.OIL_PRESSURE', 'es-ES') },
  FIRE_RISK: { key: 'FIRE_RISK', severity: 'S3_CRITICAL', icon: '!', en: uiMessage('voice.FIRE_RISK', 'en-US'), es: uiMessage('voice.FIRE_RISK', 'es-ES') },
  SIGNAL_LOST: { key: 'SIGNAL_LOST', severity: 'S1_ADVISORY', icon: '▲', en: uiMessage('voice.SIGNAL_LOST', 'en-US'), es: uiMessage('voice.SIGNAL_LOST', 'es-ES') },
  SESSION_INTERRUPTED: { key: 'SESSION_INTERRUPTED', severity: 'S2_ATTENTION', icon: '▲', en: uiMessage('voice.SESSION_INTERRUPTED', 'en-US'), es: uiMessage('voice.SESSION_INTERRUPTED', 'es-ES') },
};

export function driverAlertPhrase(key: DriverAlertKey, language: VoiceLanguage): string {
  const alert = DRIVER_ALERT_LEXICON[key];
  return language === 'es-ES' ? alert.es : alert.en;
}

export function driverAlertSeverity(key: DriverAlertKey): DriverAlertSeverity {
  return DRIVER_ALERT_LEXICON[key].severity;
}
