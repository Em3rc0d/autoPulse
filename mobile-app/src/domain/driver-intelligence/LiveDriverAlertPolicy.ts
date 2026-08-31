import type { SignalAdvisoryState } from '../telemetry/SignalAdvisory';
import {
  DRIVER_ALERT_LEXICON,
  type DriverAlertDefinition,
  type DriverAlertKey,
  type DriverAlertSeverity,
} from './DriverAlertLexicon';

export interface DriverVoicePreferenceSnapshot {
  voiceAlertsEnabled: boolean;
  criticalAlertsEnabled: boolean;
  attentionAlertsEnabled: boolean;
  advisoryAlertsEnabled: boolean;
}

export interface LiveDriverAlertMemory {
  lastKey?: DriverAlertKey;
  lastSeverity?: DriverAlertSeverity;
  lastSpokenAt?: number;
}

const SAME_ALERT_COOLDOWN_MS = 2 * 60 * 1000;

const severityRank: Record<DriverAlertSeverity, number> = {
  S0_NORMAL: 0,
  S1_ADVISORY: 1,
  S2_ATTENTION: 2,
  S3_CRITICAL: 3,
};

export function selectCoolantDriverAlert(
  state: Pick<SignalAdvisoryState, 'quality' | 'advisory'>,
  hasValue: boolean,
): DriverAlertDefinition | null {
  if (!hasValue || state.quality !== 'VALID') return null;
  if (state.advisory === 'CRITICAL') return DRIVER_ALERT_LEXICON.ENGINE_HOT;
  if (state.advisory === 'ELEVATED') return DRIVER_ALERT_LEXICON.TEMP_RISING;
  return null;
}

export function alertEnabledByPreferences(
  alert: DriverAlertDefinition,
  preferences: DriverVoicePreferenceSnapshot,
): boolean {
  if (!preferences.voiceAlertsEnabled) return false;
  if (alert.severity === 'S3_CRITICAL') return preferences.criticalAlertsEnabled;
  if (alert.severity === 'S2_ATTENTION') return preferences.attentionAlertsEnabled;
  if (alert.severity === 'S1_ADVISORY') return preferences.advisoryAlertsEnabled;
  return false;
}

export function shouldSpeakLiveAlert(
  alert: DriverAlertDefinition,
  preferences: DriverVoicePreferenceSnapshot,
  memory: LiveDriverAlertMemory,
  nowMs: number,
): boolean {
  if (!alertEnabledByPreferences(alert, preferences)) return false;

  const previousRank = memory.lastSeverity ? severityRank[memory.lastSeverity] : -1;
  const currentRank = severityRank[alert.severity];
  if (currentRank > previousRank) return true;

  if (memory.lastKey !== alert.key || memory.lastSpokenAt === undefined) return true;
  return nowMs - memory.lastSpokenAt >= SAME_ALERT_COOLDOWN_MS;
}

export function markLiveAlertSpoken(
  alert: DriverAlertDefinition,
  nowMs: number,
): LiveDriverAlertMemory {
  return {
    lastKey: alert.key,
    lastSeverity: alert.severity,
    lastSpokenAt: nowMs,
  };
}
