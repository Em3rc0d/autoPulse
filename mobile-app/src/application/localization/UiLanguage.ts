import { useEffect, useState } from 'react';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';
import { loadDriverPreferences } from '../settings/DriverPreferences';

let currentLanguage: VoiceLanguage = 'en-US';
let hydration: Promise<VoiceLanguage> | null = null;
const listeners = new Set<(language: VoiceLanguage) => void>();

export function setUiLanguage(language: VoiceLanguage) {
  currentLanguage = language;
  listeners.forEach(listener => listener(language));
}

export function getUiLanguage(): VoiceLanguage {
  return currentLanguage;
}

export async function hydrateUiLanguage(): Promise<VoiceLanguage> {
  if (!hydration) {
    hydration = loadDriverPreferences()
      .then(preferences => {
        setUiLanguage(preferences.voiceLanguage);
        return preferences.voiceLanguage;
      })
      .catch(() => currentLanguage);
  }
  return hydration;
}

export function useUiLanguage(): VoiceLanguage {
  const [language, setLanguage] = useState<VoiceLanguage>(currentLanguage);

  useEffect(() => {
    listeners.add(setLanguage);
    void hydrateUiLanguage().then(setLanguage);
    return () => {
      listeners.delete(setLanguage);
    };
  }, []);

  return language;
}

export function uiText(language: VoiceLanguage, en: string, es: string): string {
  return language === 'es-ES' ? es : en;
}
