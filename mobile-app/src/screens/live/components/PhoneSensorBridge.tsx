import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePhoneDrivingSensors } from '../../../infrastructure/sensors/usePhoneDrivingSensors';
import { useDriverMode } from './DriverModeContext';

export function PhoneSensorBridge() {
  const { selectedMode, reportDeviceSignal, reportSignalObservation } = useDriverMode();
  const sensors = usePhoneDrivingSensors(selectedMode === 'OFF_ROAD');

  useEffect(() => {
    const now = Date.now();
    const publish = (signalId: string, value: number | undefined, unit: string) => {
      if (value === undefined || !Number.isFinite(value)) return;
      reportDeviceSignal({ signalId, origin: 'DEVICE_SENSOR', quality: 'VALID', unit });
      reportSignalObservation({
        signalId,
        value,
        unit,
        quality: 'VALID',
        origin: 'DEVICE_SENSOR',
        observedAt: now,
      });
    };

    publish('ALTITUDE', sensors.altitude, 'm');
    publish('PITCH', sensors.pitch, '°');
    publish('ROLL', sensors.roll, '°');
    publish('HEADING', sensors.heading, '°');
    // Context callbacks change identity as observations are retained; publish
    // only when an actual sensor value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensors.altitude, sensors.pitch, sensors.roll, sensors.heading]);

  if (selectedMode !== 'OFF_ROAD') return null;

  const values = [
    sensors.pitch !== undefined ? { label: 'PITCH', value: `${sensors.pitch.toFixed(1)}°` } : null,
    sensors.roll !== undefined ? { label: 'ROLL', value: `${sensors.roll.toFixed(1)}°` } : null,
    sensors.altitude !== undefined ? { label: 'ALTITUDE', value: `${Math.round(sensors.altitude)} m` } : null,
    sensors.heading !== undefined ? { label: 'HEADING', value: `${Math.round(sensors.heading)}°` } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  if (values.length === 0) return null;

  return (
    <View style={styles.container}>
      {values.map(item => (
        <View key={item.label} style={styles.metric}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  value: {
    marginTop: 4,
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
});
