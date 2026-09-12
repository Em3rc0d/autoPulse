import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePhoneDrivingSensors } from '../../../infrastructure/sensors/usePhoneDrivingSensors';
import {
  OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS,
  shouldPublishSidecarSample,
} from '../../../infrastructure/sensors/OffRoadSensorPolicy';
import { useDriverMode } from './DriverModeContext';

interface Props {
  vehicleId?: string;
}

interface OffRoadCalibration {
  pitchZero: number;
  rollZero: number;
  calibratedAt: number;
}

const calibrationKey = (vehicleId: string) => `autopulse.offroad.calibration.${vehicleId}`;

export function applyOffRoadCalibration(raw: number | undefined, zero: number | undefined): number | undefined {
  if (raw === undefined || zero === undefined) return undefined;
  const calibrated = raw - zero;
  return Number.isFinite(calibrated) ? calibrated : undefined;
}

export function altitudeSignalQuality(accuracy?: number): 'VALID' | 'DEGRADED' {
  return typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy <= 50 ? 'VALID' : 'DEGRADED';
}

export function shouldPresentAltitude(altitude?: number, altitudeAccuracy?: number): boolean {
  if (typeof altitude !== 'number' || !Number.isFinite(altitude)) return false;
  if (Math.abs(altitude) <= 0.5 && altitudeAccuracy === undefined) return false;
  return true;
}

export function PhoneSensorBridge({ vehicleId }: Props) {
  const { selectedMode, reportDeviceSignal, reportSignalObservation } = useDriverMode();
  const sensors = usePhoneDrivingSensors(selectedMode === 'OFF_ROAD');
  const [calibration, setCalibration] = useState<OffRoadCalibration | null>(null);
  const [calibrationLoaded, setCalibrationLoaded] = useState(false);
  const lastContextPublishAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    if (!vehicleId) {
      setCalibration(null);
      setCalibrationLoaded(true);
      return () => { cancelled = true; };
    }

    setCalibrationLoaded(false);
    AsyncStorage.getItem(calibrationKey(vehicleId))
      .then(raw => {
        if (cancelled) return;
        if (!raw) {
          setCalibration(null);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as OffRoadCalibration;
          if (Number.isFinite(parsed.pitchZero) && Number.isFinite(parsed.rollZero) && Number.isFinite(parsed.calibratedAt)) {
            setCalibration(parsed);
          }
        } catch {
          setCalibration(null);
        }
      })
      .catch(error => {
        console.warn('[PhoneSensorBridge] Could not load Off-Road calibration:', error);
        if (!cancelled) setCalibration(null);
      })
      .finally(() => {
        if (!cancelled) setCalibrationLoaded(true);
      });

    return () => { cancelled = true; };
  }, [vehicleId]);

  const calibratedPitch = applyOffRoadCalibration(sensors.pitch, calibration?.pitchZero);
  const calibratedRoll = applyOffRoadCalibration(sensors.roll, calibration?.rollZero);
  const altitudeReady = shouldPresentAltitude(sensors.altitude, sensors.altitudeAccuracy);

  useEffect(() => {
    if (selectedMode !== 'OFF_ROAD') return;

    const now = Date.now();
    if (!shouldPublishSidecarSample(
      lastContextPublishAt.current,
      now,
      OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS,
    )) return;
    lastContextPublishAt.current = now;

    const publish = (
      signalId: string,
      value: number | undefined,
      unit: string,
      quality: 'VALID' | 'DEGRADED' = 'VALID',
    ) => {
      if (value === undefined || !Number.isFinite(value)) return;
      reportDeviceSignal({ signalId, origin: 'DEVICE_SENSOR', quality, unit });
      reportSignalObservation({ signalId, value, unit, quality, origin: 'DEVICE_SENSOR', observedAt: now });
    };

    if (altitudeReady) publish('ALTITUDE', sensors.altitude, 'm', altitudeSignalQuality(sensors.altitudeAccuracy));
    publish('HEADING', sensors.heading, '°');
    publish('PHONE_PITCH', sensors.pitch, '°');
    publish('PHONE_ROLL', sensors.roll, '°');

    if (calibration) {
      publish('PITCH', calibratedPitch, '°');
      publish('ROLL', calibratedRoll, '°');
    }
    // Phone sensor evidence is deliberately published at a human-timescale rate.
    // Local Off-Road visuals may update faster, but ECU/ELM timing always wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedMode,
    altitudeReady,
    sensors.altitude,
    sensors.altitudeAccuracy,
    sensors.pitch,
    sensors.roll,
    sensors.heading,
    calibratedPitch,
    calibratedRoll,
    calibration?.calibratedAt,
  ]);

  const canCalibrate = typeof sensors.pitch === 'number' && Number.isFinite(sensors.pitch)
    && typeof sensors.roll === 'number' && Number.isFinite(sensors.roll);

  const handleCalibrate = async () => {
    if (!canCalibrate || sensors.pitch === undefined || sensors.roll === undefined) return;
    const next: OffRoadCalibration = { pitchZero: sensors.pitch, rollZero: sensors.roll, calibratedAt: Date.now() };
    setCalibration(next);

    if (!vehicleId) return;
    try {
      await AsyncStorage.setItem(calibrationKey(vehicleId), JSON.stringify(next));
    } catch (error) {
      console.warn('[PhoneSensorBridge] Could not persist Off-Road calibration:', error);
    }
  };

  const values = useMemo(() => {
    const orientationCalibrated = Boolean(calibration);
    const pitch = orientationCalibrated ? calibratedPitch : sensors.pitch;
    const roll = orientationCalibrated ? calibratedRoll : sensors.roll;

    return [
      {
        label: orientationCalibrated ? 'PITCH' : 'PHONE PITCH',
        value: pitch !== undefined ? `${pitch.toFixed(1)}°` : '…',
        meta: orientationCalibrated ? 'vehicle' : 'phone',
      },
      {
        label: orientationCalibrated ? 'ROLL' : 'PHONE ROLL',
        value: roll !== undefined ? `${roll.toFixed(1)}°` : '…',
        meta: orientationCalibrated ? 'vehicle' : 'phone',
      },
      {
        label: 'ALTITUDE',
        value: altitudeReady && sensors.altitude !== undefined ? `${Math.round(sensors.altitude)} m` : '…',
        meta: sensors.locationPermissionRequired
          ? 'permission required'
          : altitudeReady && sensors.altitudeAccuracy !== undefined
            ? `±${Math.round(sensors.altitudeAccuracy)} m`
            : 'GPS',
      },
      {
        label: 'HEADING',
        value: sensors.heading !== undefined ? `${Math.round(sensors.heading)}°` : '…',
        meta: 'phone',
      },
    ];
  }, [
    altitudeReady,
    calibration,
    calibratedPitch,
    calibratedRoll,
    sensors.altitude,
    sensors.altitudeAccuracy,
    sensors.heading,
    sensors.locationPermissionRequired,
    sensors.pitch,
    sensors.roll,
  ]);

  if (selectedMode !== 'OFF_ROAD') return null;

  return (
    <View style={styles.container}>
      <View style={styles.calibrationRow}>
        <View style={styles.calibrationCopy}>
          <Text style={styles.calibrationTitle}>{calibration ? 'VEHICLE ATTITUDE' : 'PHONE ATTITUDE'}</Text>
          <Text numberOfLines={1} style={styles.calibrationText}>
            {!calibrationLoaded
              ? 'Loading calibration…'
              : calibration
                ? 'Level reference calibrated'
                : 'Mount phone securely, park level, then calibrate'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.calibrateButton, !canCalibrate && styles.calibrateButtonDisabled]}
          disabled={!canCalibrate}
          onPress={handleCalibrate}
        >
          <Text style={styles.calibrateButtonText}>{calibration ? 'Recalibrate' : 'Calibrate'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricRow}>
        {values.map(item => (
          <View key={item.label} style={styles.metric}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.label}>{item.label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>{item.value}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.meta}>{item.meta}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 3, marginBottom: 3 },
  calibrationRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#11191d',
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 6,
  },
  calibrationCopy: { flex: 1 },
  calibrationTitle: { color: '#cbd5e1', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  calibrationText: { marginTop: 2, color: '#64748b', fontSize: 8 },
  calibrateButton: { borderRadius: 999, borderWidth: 1, borderColor: '#d7ff4f', paddingHorizontal: 9, paddingVertical: 5 },
  calibrateButtonDisabled: { opacity: 0.35 },
  calibrateButtonText: { color: '#d7ff4f', fontSize: 8, fontWeight: '800' },
  metricRow: { flexDirection: 'row', gap: 5 },
  metric: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263239',
    backgroundColor: '#11191d',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  label: { color: '#64748b', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
  value: { marginTop: 3, color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  meta: { marginTop: 1, color: '#64748b', fontSize: 7 },
});
