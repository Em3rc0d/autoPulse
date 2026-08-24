import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePhoneDrivingSensors } from '../../../infrastructure/sensors/usePhoneDrivingSensors';
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

export function applyOffRoadCalibration(
  raw: number | undefined,
  zero: number | undefined,
): number | undefined {
  if (raw === undefined || zero === undefined) return undefined;
  const calibrated = raw - zero;
  return Number.isFinite(calibrated) ? calibrated : undefined;
}

export function altitudeSignalQuality(accuracy?: number): 'VALID' | 'DEGRADED' {
  return typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy <= 50
    ? 'VALID'
    : 'DEGRADED';
}

export function PhoneSensorBridge({ vehicleId }: Props) {
  const { selectedMode, reportDeviceSignal, reportSignalObservation } = useDriverMode();
  const sensors = usePhoneDrivingSensors(selectedMode === 'OFF_ROAD');
  const [calibration, setCalibration] = useState<OffRoadCalibration | null>(null);
  const [calibrationLoaded, setCalibrationLoaded] = useState(false);

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
          if (
            Number.isFinite(parsed.pitchZero) &&
            Number.isFinite(parsed.rollZero) &&
            Number.isFinite(parsed.calibratedAt)
          ) {
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

  useEffect(() => {
    const now = Date.now();
    const publish = (
      signalId: string,
      value: number | undefined,
      unit: string,
      quality: 'VALID' | 'DEGRADED' = 'VALID',
    ) => {
      if (value === undefined || !Number.isFinite(value)) return;
      reportDeviceSignal({ signalId, origin: 'DEVICE_SENSOR', quality, unit });
      reportSignalObservation({
        signalId,
        value,
        unit,
        quality,
        origin: 'DEVICE_SENSOR',
        observedAt: now,
      });
    };

    publish('ALTITUDE', sensors.altitude, 'm', altitudeSignalQuality(sensors.altitudeAccuracy));
    publish('HEADING', sensors.heading, '°');

    // Raw phone orientation is observable, but it is not vehicle attitude.
    publish('PHONE_PITCH', sensors.pitch, '°');
    publish('PHONE_ROLL', sensors.roll, '°');

    // Only a calibrated phone-to-vehicle reference is allowed to satisfy the
    // vehicle attitude dimensions used by Off-Road mode.
    if (calibration) {
      publish('PITCH', calibratedPitch, '°');
      publish('ROLL', calibratedRoll, '°');
    }
    // Context callbacks change identity as observations are retained; publish
    // only when an actual sensor/calibration value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sensors.altitude,
    sensors.altitudeAccuracy,
    sensors.pitch,
    sensors.roll,
    sensors.heading,
    calibratedPitch,
    calibratedRoll,
    calibration?.calibratedAt,
  ]);

  const canCalibrate = Number.isFinite(sensors.pitch) && Number.isFinite(sensors.roll);

  const handleCalibrate = async () => {
    if (!canCalibrate || sensors.pitch === undefined || sensors.roll === undefined) return;
    const next: OffRoadCalibration = {
      pitchZero: sensors.pitch,
      rollZero: sensors.roll,
      calibratedAt: Date.now(),
    };
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
        label: orientationCalibrated ? 'VEHICLE PITCH' : 'PHONE PITCH',
        value: pitch !== undefined ? `${pitch.toFixed(1)}°` : 'Acquiring…',
        meta: orientationCalibrated ? 'Vehicle-relative · calibrated' : 'Phone-relative · calibration required',
      },
      {
        label: orientationCalibrated ? 'VEHICLE ROLL' : 'PHONE ROLL',
        value: roll !== undefined ? `${roll.toFixed(1)}°` : 'Acquiring…',
        meta: orientationCalibrated ? 'Vehicle-relative · calibrated' : 'Phone-relative · calibration required',
      },
      {
        label: 'ALTITUDE',
        value: sensors.altitude !== undefined ? `${Math.round(sensors.altitude)} m` : 'Acquiring…',
        meta: sensors.altitudeAccuracy !== undefined
          ? `Phone GPS · ±${Math.round(sensors.altitudeAccuracy)} m`
          : 'Phone GPS · accuracy pending',
      },
      {
        label: 'HEADING',
        value: sensors.heading !== undefined ? `${Math.round(sensors.heading)}°` : 'Acquiring…',
        meta: 'Phone sensor',
      },
    ];
  }, [calibration, calibratedPitch, calibratedRoll, sensors.altitude, sensors.altitudeAccuracy, sensors.heading, sensors.pitch, sensors.roll]);

  if (selectedMode !== 'OFF_ROAD') return null;

  return (
    <View style={styles.container}>
      <View style={styles.calibrationRow}>
        <View style={styles.calibrationCopy}>
          <Text style={styles.calibrationTitle}>
            {calibration ? 'VEHICLE-RELATIVE ATTITUDE' : 'PHONE-RELATIVE ATTITUDE'}
          </Text>
          <Text style={styles.calibrationText}>
            {!calibrationLoaded
              ? 'Loading saved calibration…'
              : calibration
                ? 'Level reference is calibrated for this vehicle.'
                : 'Mount the phone securely, park level, then calibrate.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.calibrateButton, !canCalibrate && styles.calibrateButtonDisabled]}
          disabled={!canCalibrate}
          onPress={handleCalibrate}
        >
          <Text style={styles.calibrateButtonText}>{calibration ? 'Recalibrate' : 'Calibrate level'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsGrid}>
        {values.map(item => (
          <View key={item.label} style={styles.metric}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>{item.value}</Text>
            <Text style={styles.meta}>{item.meta}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  calibrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#11191d',
    padding: 12,
    marginBottom: 8,
  },
  calibrationCopy: { flex: 1 },
  calibrationTitle: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  calibrationText: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  calibrateButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7ff4f',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  calibrateButtonDisabled: { opacity: 0.35 },
  calibrateButtonText: {
    color: '#d7ff4f',
    fontSize: 10,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metric: {
    minWidth: '46%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#11191d',
    padding: 12,
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  value: {
    marginTop: 4,
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 9,
    lineHeight: 12,
  },
});
