import { loadDriverPreferences } from '../settings/DriverPreferences';
import {
  DRIVER_ALERT_LEXICON,
  driverAlertPhrase,
  type DriverAlertKey,
} from '../../domain/driver-intelligence/DriverAlertLexicon';
import { alertEnabledByPreferences } from '../../domain/driver-intelligence/LiveDriverAlertPolicy';
import { speakDriverMessage } from '../../infrastructure/voice/AndroidDriverVoice';

/**
 * For bounded one-shot system events that still need to honor the same voice
 * language and severity preferences as live Safety alerts. This deliberately
 * accepts only lexicon keys; arbitrary UI prose never reaches TTS through it.
 */
export async function announceOneShotDriverAlert(key: DriverAlertKey): Promise<boolean> {
  try {
    const preferences = await loadDriverPreferences();
    const alert = DRIVER_ALERT_LEXICON[key];
    if (!alertEnabledByPreferences(alert, preferences)) return false;
    return await speakDriverMessage(driverAlertPhrase(key, preferences.voiceLanguage), preferences.voiceLanguage);
  } catch (error) {
    console.warn('[DriverVoiceNotificationService] Announcement degraded:', error);
    return false;
  }
}
