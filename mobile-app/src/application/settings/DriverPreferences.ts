import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';

export interface DriverPreferences {
  voiceAlertsEnabled: boolean;
  voiceLanguage: VoiceLanguage;
  criticalAlertsEnabled: boolean;
  attentionAlertsEnabled: boolean;
  advisoryAlertsEnabled: boolean;
}

export const DEFAULT_DRIVER_PREFERENCES: DriverPreferences = {
  voiceAlertsEnabled: true,
  voiceLanguage: 'en-US',
  criticalAlertsEnabled: true,
  attentionAlertsEnabled: true,
  advisoryAlertsEnabled: false,
};

const STORAGE_KEY = '@autopulse/driver-preferences/v1';

function normalizePreferences(value: Partial<DriverPreferences> | null | undefined): DriverPreferences {
  const language: VoiceLanguage = value?.voiceLanguage === 'es-ES' ? 'es-ES' : 'en-US';
  return {
    voiceAlertsEnabled: value?.voiceAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.voiceAlertsEnabled,
    voiceLanguage: language,
    criticalAlertsEnabled: value?.criticalAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.criticalAlertsEnabled,
    attentionAlertsEnabled: value?.attentionAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.attentionAlertsEnabled,
    advisoryAlertsEnabled: value?.advisoryAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.advisoryAlertsEnabled,
  };
}

export async function loadDriverPreferences(): Promise<DriverPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DRIVER_PREFERENCES;
    return normalizePreferences(JSON.parse(raw) as Partial<DriverPreferences>);
  } catch (error) {
    console.warn('[DriverPreferences] Falling back to defaults:', error);
    return DEFAULT_DRIVER_PREFERENCES;
  }
}

export async function saveDriverPreferences(preferences: DriverPreferences): Promise<DriverPreferences> {
  const normalized = normalizePreferences(preferences);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function updateDriverPreferences(
  patch: Partial<DriverPreferences>,
): Promise<DriverPreferences> {
  const current = await loadDriverPreferences();
  return saveDriverPreferences({ ...current, ...patch });
}
