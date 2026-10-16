jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  }
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_DRIVER_PREFERENCES,
  loadDriverPreferences,
  saveDriverPreferences,
  subscribeDriverPreferences,
} from '../DriverPreferences';

const setItem = AsyncStorage.setItem as jest.Mock;
const getItem = AsyncStorage.getItem as jest.Mock;

describe('durable driver preferences runtime broadcast', () => {
  beforeEach(() => {
    getItem.mockReset().mockResolvedValue(null);
    setItem.mockReset().mockResolvedValue(undefined);
  });

  it('applies English default for a fresh install', async () => {
    expect((await loadDriverPreferences()).voiceLanguage).toBe('en-US');
  });

  it('notifies Live only after a successful save, never during a pending write', async () => {
    let completeWrite: (() => void) | undefined;
    setItem.mockImplementationOnce(() => new Promise<void>(resolve => { completeWrite = resolve; }));
    const listener = jest.fn();
    const unsubscribe = subscribeDriverPreferences(listener);
    try {
      const promise = saveDriverPreferences({ ...DEFAULT_DRIVER_PREFERENCES, voiceLanguage: 'es-ES' });
      expect(listener).not.toHaveBeenCalled();
      completeWrite?.();
      const stored = await promise;
      expect(stored.voiceLanguage).toBe('es-ES');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ voiceLanguage: 'es-ES' }));
    } finally { unsubscribe(); }
  });

  it('does not notify a spoken locale change if AsyncStorage fails', async () => {
    setItem.mockRejectedValueOnce(new Error('disk unavailable'));
    const listener = jest.fn();
    const unsubscribe = subscribeDriverPreferences(listener);
    try {
      await expect(saveDriverPreferences({ ...DEFAULT_DRIVER_PREFERENCES, voiceLanguage: 'es-ES' })).rejects.toThrow('disk unavailable');
      expect(listener).not.toHaveBeenCalled();
    } finally { unsubscribe(); }
  });

  it('stops broadcasting to unmounted Live views', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeDriverPreferences(listener);
    unsubscribe();
    await saveDriverPreferences(DEFAULT_DRIVER_PREFERENCES);
    expect(listener).not.toHaveBeenCalled();
  });
});
