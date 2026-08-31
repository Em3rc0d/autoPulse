import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_DRIVER_VOICE_LANGUAGE,
  type DriverVoiceLanguage,
} from '../../domain/driver-intelligence/DriverAlertLexicon';

const DRIVER_VOICE_LANGUAGE_KEY = '@autopulse/driver-voice-language';

export const DRIVER_VOICE_LANGUAGE_OPTIONS: readonly {
  value: DriverVoiceLanguage;
  label: string;
  detail: string;
}[] = [
  { value: 'en-US', label: 'English', detail: 'Default' },
  { value: 'es-ES', label: 'Español', detail: 'Alertas de conducción' },
];

export function isDriverVoiceLanguage(value: unknown): value is DriverVoiceLanguage {
  return value === 'en-US' || value === 'es-ES';
}

export async function loadDriverVoiceLanguage(): Promise<DriverVoiceLanguage> {
  try {
    const stored = await AsyncStorage.getItem(DRIVER_VOICE_LANGUAGE_KEY);
    return isDriverVoiceLanguage(stored) ? stored : DEFAULT_DRIVER_VOICE_LANGUAGE;
  } catch (error) {
    console.warn('[DriverVoicePreferences] Read degraded:', error);
    return DEFAULT_DRIVER_VOICE_LANGUAGE;
  }
}

export async function saveDriverVoiceLanguage(language: DriverVoiceLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(DRIVER_VOICE_LANGUAGE_KEY, language);
  } catch (error) {
    console.warn('[DriverVoicePreferences] Write degraded:', error);
  }
}
