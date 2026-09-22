import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DRIVER_PREFERENCES,
  loadDriverPreferences,
  subscribeDriverPreferences,
  type AppLanguage,
} from '../settings/DriverPreferences';

export function localized(language: AppLanguage, english: string, spanish: string): string {
  return language === 'es-ES' ? spanish : english;
}

export function useAppLanguage() {
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_DRIVER_PREFERENCES.appLanguage);

  useEffect(() => {
    let mounted = true;
    void loadDriverPreferences().then(preferences => {
      if (mounted) setLanguage(preferences.appLanguage);
    });
    const unsubscribe = subscribeDriverPreferences(preferences => {
      if (mounted) setLanguage(preferences.appLanguage);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const text = useCallback(
    (english: string, spanish: string) => localized(language, english, spanish),
    [language],
  );

  return {
    language,
    isSpanish: language === 'es-ES',
    text,
  };
}
