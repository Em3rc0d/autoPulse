import { Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

export type LiveForegroundServiceFailureListener = (reason: string) => void;

let running = false;
let lastFailure: string | null = null;
let lifecycleEpoch = 0;
let nativeStartMayBeActive = false;
let pendingStart: Promise<boolean> | null = null;
let operationQueue: Promise<void> = Promise.resolve();
const failureListeners = new Set<LiveForegroundServiceFailureListener>();

function notifyFailure(reason: string) {
  lifecycleEpoch += 1;
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

/** Serializes start/stop so a late native start cannot resurrect a stopped session. */
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** Native errors invalidate any in-flight start, even before its promise resolves. */
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
 * A native start is asynchronous. Never report a background-capable session
 * until Android's foreground-service start promise has resolved successfully.
 * STOP invalidates any pending start, and native transitions are serialized.
 */
export function startLiveForegroundService(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  if (running) return Promise.resolve(true);
  if (pendingStart) return pendingStart;

  const epoch = ++lifecycleEpoch;
  lastFailure = null;
  const start = enqueue(async () => {
    if (epoch !== lifecycleEpoch) return false;
    if (nativeStartMayBeActive) {
      notifyFailure('PREVIOUS_FOREGROUND_SERVICE_STOP_UNCONFIRMED');
      return false;
    }

    nativeStartMayBeActive = true;
    try {
      await ReactNativeForegroundService.start({
        id: 1234,
        title: 'AutoPulse',
        message: 'Live OBD session active',
        // Mandatory for @supersami/rn-foreground-service 2.2.5 and API 34+.
        // Must match AndroidManifest foregroundServiceType=connectedDevice.
        ServiceType: 'connectedDevice',
        icon: 'ic_launcher',
        button: false,
        button2: false,
        setOnlyAlertOnce: 'true',
        color: '#000000',
      });
      if (epoch !== lifecycleEpoch) return false;
      running = true;
      return true;
    } catch (error) {
      if (epoch === lifecycleEpoch) {
        console.warn('[LiveForegroundService] Could not start foreground service', error);
        notifyFailure('FOREGROUND_SERVICE_START_FAILED');
      }
      return false;
    }
  });
  pendingStart = start;
  void start.then(() => {
    if (pendingStart === start) pendingStart = null;
  });
  return start;
}

/**
 * A stop requested during pending start waits for native start to settle and
 * then stops the service. A subsequent start waits for that cleanup to finish.
 */
export function stopLiveForegroundService(): Promise<void> {
  lifecycleEpoch += 1;
  running = false;
  pendingStart = null;
  if (Platform.OS !== 'android') return Promise.resolve();

  return enqueue(async () => {
    if (!nativeStartMayBeActive) return;
    try {
      await ReactNativeForegroundService.stopAll();
      nativeStartMayBeActive = false;
    } catch (error) {
      console.warn('[LiveForegroundService] Could not stop foreground service', error);
      notifyFailure('FOREGROUND_SERVICE_STOP_FAILED');
      throw error;
    }
  });
}
