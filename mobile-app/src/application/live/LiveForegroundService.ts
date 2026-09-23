import { Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

let running = false;

export function startLiveForegroundService() {
  if (Platform.OS !== 'android' || running) return;
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
  } catch (error) {
    console.warn('[LiveForegroundService] Could not start foreground service', error);
  }
}

export function stopLiveForegroundService() {
  if (Platform.OS !== 'android' || !running) return;
  try {
    ReactNativeForegroundService.stopAll();
  } catch (error) {
    console.warn('[LiveForegroundService] Could not stop foreground service', error);
  } finally {
    running = false;
  }
}
