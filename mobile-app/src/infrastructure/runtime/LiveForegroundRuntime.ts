import { Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

let activeSessionId: string | null = null;

export function startLiveForegroundRuntime(sessionId: string) {
  if (Platform.OS !== 'android') return;
  if (activeSessionId === sessionId) return;

  if (activeSessionId) {
    try {
      ReactNativeForegroundService.stopAll();
    } catch {
      // Best effort: a new session will immediately establish the current notification.
    }
  }

  try {
    ReactNativeForegroundService.start({
      id: 1234,
      title: 'AutoPulse',
      message: 'Live OBD session active',
      icon: 'ic_launcher',
      button: false,
      button2: false,
      setOnlyAlertOnce: 'true',
      color: '#000000',
    });
    activeSessionId = sessionId;
  } catch (error) {
    console.warn('[LiveForegroundRuntime] Could not start foreground service', error);
  }
}

export function stopLiveForegroundRuntime(sessionId: string) {
  if (Platform.OS !== 'android') return;
  if (activeSessionId !== sessionId) return;
  try {
    ReactNativeForegroundService.stopAll();
  } catch (error) {
    console.warn('[LiveForegroundRuntime] Could not stop foreground service', error);
  } finally {
    activeSessionId = null;
  }
}

export function getLiveForegroundSessionId(): string | null {
  return activeSessionId;
}
