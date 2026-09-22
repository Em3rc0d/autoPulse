import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';

export type AppLanguage = VoiceLanguage;

export interface DriverPreferences {
  voiceAlertsEnabled: boolean;
  voiceLanguage: VoiceLanguage;
  appLanguage: AppLanguage;
  criticalAlertsEnabled: boolean;
  attentionAlertsEnabled: boolean;
  advisoryAlertsEnabled: boolean;
}

export const DEFAULT_DRIVER_PREFERENCES: DriverPreferences = {
  voiceAlertsEnabled: true,
  voiceLanguage: 'en-US',
  appLanguage: 'en-US',
  criticalAlertsEnabled: true,
  attentionAlertsEnabled: true,
  advisoryAlertsEnabled: false,
};

const STORAGE_KEY = '@autopulse/driver-preferences/v1';
const listeners = new Set<(preferences: DriverPreferences) => void>();

function normalizePreferences(value: Partial<DriverPreferences> | null | undefined): DriverPreferences {
  const voiceLanguage: VoiceLanguage = value?.voiceLanguage === 'es-ES' ? 'es-ES' : 'en-US';
  // Backward compatibility: existing users who had selected Spanish for voice
  // before appLanguage existed should immediately receive Spanish UI as well.
  const appLanguage: AppLanguage = value?.appLanguage === 'es-ES'
    ? 'es-ES'
    : value?.appLanguage === 'en-US'
      ? 'en-US'
      : voiceLanguage;

  return {
    voiceAlertsEnabled: value?.voiceAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.voiceAlertsEnabled,
    voiceLanguage,
    appLanguage,
    criticalAlertsEnabled: value?.criticalAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.criticalAlertsEnabled,
    attentionAlertsEnabled: value?.attentionAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.attentionAlertsEnabled,
    advisoryAlertsEnabled: value?.advisoryAlertsEnabled ?? DEFAULT_DRIVER_PREFERENCES.advisoryAlertsEnabled,
  };
}

function publish(preferences: DriverPreferences) {
  listeners.forEach(listener => listener(preferences));
}

export function subscribeDriverPreferences(listener: (preferences: DriverPreferences) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
  publish(normalized);
  return normalized;
}

export async function updateDriverPreferences(
  patch: Partial<DriverPreferences>,
): Promise<DriverPreferences> {
  const current = await loadDriverPreferences();
  return saveDriverPreferences({ ...current, ...patch });
}
