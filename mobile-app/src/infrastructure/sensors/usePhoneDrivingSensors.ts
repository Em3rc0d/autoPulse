import { useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface PhoneDrivingSensors {
  altitude?: number;
  altitudeAccuracy?: number;
  horizontalAccuracy?: number;
  pitch?: number;
  roll?: number;
  heading?: number;
  locationObservedAt?: number;
  motionObservedAt?: number;
  locationAvailable: boolean;
  locationPermissionRequired: boolean;
  motionAvailable: boolean;
}

interface MotionEvent {
  pitch: number;
  roll: number;
  heading: number;
  timestamp: number;
}

const motionModule = NativeModules.AutoPulseMotion;
const MOTION_UI_MIN_INTERVAL_MS = 200;

export function shouldEmitMotionSample(
  lastPublishedAt: number,
  candidateObservedAt: number,
  minimumIntervalMs: number = MOTION_UI_MIN_INTERVAL_MS,
): boolean {
  if (!Number.isFinite(candidateObservedAt)) return false;
  if (!Number.isFinite(lastPublishedAt) || lastPublishedAt <= 0) return true;
  return candidateObservedAt - lastPublishedAt >= minimumIntervalMs;
}

export function usePhoneDrivingSensors(enabled: boolean): PhoneDrivingSensors {
  const [state, setState] = useState<PhoneDrivingSensors>({
    locationAvailable: false,
    locationPermissionRequired: false,
    motionAvailable: false,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let locationSubscription: Location.LocationSubscription | undefined;
    let motionSubscription: { remove(): void } | undefined;
    let lastMotionPublishedAt = 0;

    const start = async () => {
      // Never open a system permission dialog while a real Live session is active.
      // Android can surface that dialog as an app lifecycle transition, and release-1
      // intentionally terminates foreground-only recording when the app backgrounds.
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.granted && !cancelled) {
          setState(current => ({ ...current, locationPermissionRequired: false }));
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
                altitudeAccuracy: location.coords.altitudeAccuracy ?? current.altitudeAccuracy,
                horizontalAccuracy: location.coords.accuracy ?? current.horizontalAccuracy,
                heading: location.coords.heading ?? current.heading,
                locationObservedAt: location.timestamp,
                locationAvailable: true,
                locationPermissionRequired: false,
              }));
            },
          );
        } else if (!cancelled) {
          setState(current => ({
            ...current,
            locationAvailable: false,
            locationPermissionRequired: true,
          }));
        }
      } catch (error) {
        console.warn('[PhoneDrivingSensors] Location unavailable:', error);
        if (!cancelled) {
          setState(current => ({
            ...current,
            locationAvailable: false,
          }));
        }
      }

      if (Platform.OS === 'android' && motionModule) {
        try {
          const emitter = new NativeEventEmitter(motionModule);
          motionSubscription = emitter.addListener('AutoPulseMotion', (event: MotionEvent) => {
            if (cancelled) return;
            const observedAt = Number.isFinite(event.timestamp) ? event.timestamp : Date.now();
            if (!shouldEmitMotionSample(lastMotionPublishedAt, observedAt)) return;
            lastMotionPublishedAt = observedAt;

            setState(current => ({
              ...current,
              pitch: event.pitch,
              roll: event.roll,
              heading: Number.isFinite(event.heading) ? event.heading : current.heading,
              motionObservedAt: observedAt,
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
        // no-op: phone sensor cleanup must never affect Live teardown
      }
    };
  }, [enabled]);

  return state;
}
