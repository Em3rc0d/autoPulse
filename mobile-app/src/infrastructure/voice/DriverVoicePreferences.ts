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

async function getAsyncStorage() {
  // Keep native storage out of module initialization. This makes the voice
  // adapter safe to import in non-native runtimes while still persisting the
  // preference on device.
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
}

export async function loadDriverVoiceLanguage(): Promise<DriverVoiceLanguage> {
  try {
    const AsyncStorage = await getAsyncStorage();
    const stored = await AsyncStorage.getItem(DRIVER_VOICE_LANGUAGE_KEY);
    return isDriverVoiceLanguage(stored) ? stored : DEFAULT_DRIVER_VOICE_LANGUAGE;
  } catch (error) {
    console.warn('[DriverVoicePreferences] Read degraded:', error);
    return DEFAULT_DRIVER_VOICE_LANGUAGE;
  }
}

export async function saveDriverVoiceLanguage(language: DriverVoiceLanguage): Promise<void> {
  try {
    const AsyncStorage = await getAsyncStorage();
    await AsyncStorage.setItem(DRIVER_VOICE_LANGUAGE_KEY, language);
  } catch (error) {
    console.warn('[DriverVoicePreferences] Write degraded:', error);
  }
}
