import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';
import {
  DEFAULT_DRIVER_PREFERENCES,
  loadDriverPreferences,
  saveDriverPreferences,
} from '../../../application/settings/DriverPreferences';
import { setUiLanguage } from '../../../application/localization/UiLanguage';

jest.mock('../../../application/settings/DriverPreferences', () => {
  const defaults = {
    voiceAlertsEnabled: true,
    voiceLanguage: 'en-US',
    criticalAlertsEnabled: true,
    attentionAlertsEnabled: true,
    advisoryAlertsEnabled: false,
  };
  return {
    DEFAULT_DRIVER_PREFERENCES: defaults,
    loadDriverPreferences: jest.fn(async () => ({ ...defaults })),
    saveDriverPreferences: jest.fn(async (value: unknown) => value),
  };
});
jest.mock('../../../application/localization/UiLanguage', () => ({
  setUiLanguage: jest.fn(),
  uiText: (locale: string, english: string, spanish: string) =>
    locale === 'es-ES' ? spanish : english,
}));

const load = loadDriverPreferences as jest.Mock;
const save = saveDriverPreferences as jest.Mock;
const notify = setUiLanguage as jest.Mock;

describe('Settings language durability and recovery', () => {
  beforeEach(() => {
    load.mockReset().mockResolvedValue({ ...DEFAULT_DRIVER_PREFERENCES });
    save.mockReset().mockImplementation(async (value: unknown) => value);
    notify.mockClear();
  });

  it('publishes the new UI and spoken locale only after storage succeeds', async () => {
    let finishSave: ((value: unknown) => void) | undefined;
    save.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    const screen = render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByText('Español')).toBeTruthy());
    fireEvent.press(screen.getByText('Español'));
    expect(notify).not.toHaveBeenCalledWith('es-ES');
    finishSave?.({ ...DEFAULT_DRIVER_PREFERENCES, voiceLanguage: 'es-ES' });
    await waitFor(() => expect(notify).toHaveBeenCalledWith('es-ES'));
    expect(screen.queryByTestId('settings-save-error')).toBeNull();
  });

  it('rolls back the visible locale after AsyncStorage write failure', async () => {
    save.mockRejectedValueOnce(new Error('AsyncStorage write blocked'));
    const log = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const screen = render(<SettingsScreen />);
      await waitFor(() => expect(screen.getByText('Español')).toBeTruthy());
      fireEvent.press(screen.getByText('Español'));
      await waitFor(() => expect(screen.getByTestId('settings-save-error')).toBeTruthy());
      expect(screen.getByText('Could not save settings. Try again.')).toBeTruthy();
      expect(notify).not.toHaveBeenCalledWith('es-ES');
      expect(notify).toHaveBeenCalledWith('en-US');
    } finally {
      log.mockRestore();
    }
  });
});
