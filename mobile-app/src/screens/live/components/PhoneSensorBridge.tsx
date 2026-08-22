import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePhoneDrivingSensors } from '../../../infrastructure/sensors/usePhoneDrivingSensors';
import { useDriverMode } from './DriverModeContext';

export function PhoneSensorBridge() {
  const { selectedMode, reportDeviceSignal } = useDriverMode();
  const sensors = usePhoneDrivingSensors(selectedMode === 'OFF_ROAD');

  useEffect(() => {
    if (sensors.altitude !== undefined) {
      reportDeviceSignal({ signalId: 'ALTITUDE', origin: 'DEVICE_SENSOR', quality: 'VALID', unit: 'm' });
    }
    if (sensors.pitch !== undefined) {
      reportDeviceSignal({ signalId: 'PITCH', origin: 'DEVICE_SENSOR', quality: 'VALID', unit: '°' });
    }
    if (sensors.roll !== undefined) {
      reportDeviceSignal({ signalId: 'ROLL', origin: 'DEVICE_SENSOR', quality: 'VALID', unit: '°' });
    }
    if (sensors.heading !== undefined) {
      reportDeviceSignal({ signalId: 'HEADING', origin: 'DEVICE_SENSOR', quality: 'VALID', unit: '°' });
    }
  }, [reportDeviceSignal, sensors.altitude, sensors.pitch, sensors.roll, sensors.heading]);

  if (selectedMode !== 'OFF_ROAD') return null;

  const values = [
    sensors.pitch !== undefined ? { label: 'PITCH', value: `${sensors.pitch.toFixed(1)}°` } : null,
    sensors.roll !== undefined ? { label: 'ROLL', value: `${sensors.roll.toFixed(1)}°` } : null,
    sensors.altitude !== undefined ? { label: 'ALTITUDE', value: `${Math.round(sensors.altitude)} m` } : null,
    sensors.heading !== undefined ? { label: 'HEADING', value: `${Math.round(sensors.heading)}°` } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  // Unknown phone signals stay invisible, matching the global AutoPulse UX rule.
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
