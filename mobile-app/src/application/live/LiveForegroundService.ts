import { Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

export type LiveForegroundServiceFailureListener = (reason: string) => void;

let running = false;
let lastFailure: string | null = null;
const failureListeners = new Set<LiveForegroundServiceFailureListener>();

function notifyFailure(reason: string) {
  running = false;
  lastFailure = reason;
  failureListeners.forEach(listener => {
    try {
      listener(reason);
    } catch (error) {
      console.warn('[LiveForegroundService] Failure listener threw', error);
    }
  });
}

/**
 * Called from the native foreground-service registration callback when Android
 * reports that the connected-device service could not remain active.
 */
export function reportLiveForegroundServiceFailure(reason = 'NATIVE_SERVICE_ERROR') {
  notifyFailure(reason);
}

export function subscribeLiveForegroundServiceFailure(
  listener: LiveForegroundServiceFailureListener,
): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

export function getLiveForegroundServiceState(): {
  running: boolean;
  lastFailure: string | null;
} {
  return { running, lastFailure };
}

/**
 * Background-capable Live depends on the Android connected-device foreground
 * service. Failure is explicit: callers must not silently claim that a session
 * can continue in background if this returns false.
 */
export function startLiveForegroundService(): boolean {
  if (Platform.OS !== 'android') return true;
  if (running) return true;

  lastFailure = null;
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
    running = true;
    return true;
  } catch (error) {
    console.warn('[LiveForegroundService] Could not start foreground service', error);
    notifyFailure('FOREGROUND_SERVICE_START_FAILED');
    return false;
  }
}

export function stopLiveForegroundService() {
  if (Platform.OS !== 'android' || !running) {
    running = false;
    return;
  }
  try {
    ReactNativeForegroundService.stopAll();
  } catch (error) {
    console.warn('[LiveForegroundService] Could not stop foreground service', error);
  } finally {
    running = false;
  }
}
