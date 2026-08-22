import { useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface PhoneDrivingSensors {
  altitude?: number;
  pitch?: number;
  roll?: number;
  heading?: number;
  locationAvailable: boolean;
  motionAvailable: boolean;
}

interface MotionEvent {
  pitch: number;
  roll: number;
  heading: number;
  timestamp: number;
}

const motionModule = NativeModules.AutoPulseMotion;

export function usePhoneDrivingSensors(enabled: boolean): PhoneDrivingSensors {
  const [state, setState] = useState<PhoneDrivingSensors>({
    locationAvailable: false,
    motionAvailable: false,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let locationSubscription: Location.LocationSubscription | undefined;
    let motionSubscription: { remove(): void } | undefined;

    const start = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted && !cancelled) {
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 1000,
              distanceInterval: 2,
            },
            location => {
              if (cancelled) return;
              setState(current => ({
                ...current,
                altitude: location.coords.altitude ?? current.altitude,
                heading: location.coords.heading ?? current.heading,
                locationAvailable: true,
              }));
            },
          );
        }
      } catch (error) {
        console.warn('[PhoneDrivingSensors] Location unavailable:', error);
      }

      if (Platform.OS === 'android' && motionModule) {
        try {
          const emitter = new NativeEventEmitter(motionModule);
          motionSubscription = emitter.addListener('AutoPulseMotion', (event: MotionEvent) => {
            if (cancelled) return;
            setState(current => ({
              ...current,
              pitch: event.pitch,
              roll: event.roll,
              heading: Number.isFinite(event.heading) ? event.heading : current.heading,
              motionAvailable: true,
            }));
          });
          motionModule.start();
        } catch (error) {
          console.warn('[PhoneDrivingSensors] Motion unavailable:', error);
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      locationSubscription?.remove();
      motionSubscription?.remove();
      try {
        motionModule?.stop?.();
      } catch {
        // no-op: sensor cleanup must never affect Live teardown
      }
    };
  }, [enabled]);

  return state;
}
