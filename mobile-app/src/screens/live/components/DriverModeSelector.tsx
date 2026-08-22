import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  DRIVING_MODE_ORDER,
  DRIVING_MODE_PRESENTATION,
  resolveDrivingMode,
  type AvailableSignal,
  type DrivingMode,
} from '../../../domain/driver-intelligence';

interface Props {
  selectedMode: DrivingMode;
  availableSignals: readonly AvailableSignal[];
  onSelectMode: (mode: DrivingMode) => void;
}

export function DriverModeSelector({ selectedMode, availableSignals, onSelectMode }: Props) {
  const resolved = resolveDrivingMode(selectedMode, availableSignals);
  const presentation = DRIVING_MODE_PRESENTATION[selectedMode];

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>DRIVER MODE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DRIVING_MODE_ORDER.map(mode => {
          const item = DRIVING_MODE_PRESENTATION[mode];
          const active = mode === selectedMode;
          const modeResolution = resolveDrivingMode(mode, availableSignals);
          const signalCount = modeResolution.selectedSignals.length;

          return (
            <TouchableOpacity
              key={mode}
              testID={`driver-mode-${mode.toLowerCase()}`}
              style={[styles.modeButton, active && styles.modeButtonActive]}
              onPress={() => onSelectMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeIcon, active && styles.modeTextActive]}>{item.icon}</Text>
              <Text style={[styles.modeLabel, active && styles.modeTextActive]}>{item.shortLabel}</Text>
              <Text style={[styles.modeCount, active && styles.modeTextActive]}>{signalCount} signals</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>{presentation.label}</Text>
            <Text style={styles.summaryPurpose}>{presentation.purpose}</Text>
          </View>
          <View style={[styles.statePill, resolved.degraded ? styles.statePillDegraded : styles.statePillReady]}>
            <Text style={styles.stateText}>{resolved.degraded ? 'ADAPTIVE' : 'READY'}</Text>
          </View>
        </View>

        <Text style={styles.signalSummary}>
          Using {resolved.selectedSignals.length} available signal{resolved.selectedSignals.length === 1 ? '' : 's'}
          {resolved.missingPreferredSignals.length > 0
            ? ` · ${resolved.missingPreferredSignals.length} preferred unavailable`
            : ' · full preferred set available'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  eyebrow: {
    color: '#6b7280',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  row: { paddingRight: 16, gap: 10 },
  modeButton: {
    minWidth: 104,
    backgroundColor: '#172026',
    borderColor: '#2a3439',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeButtonActive: {
    backgroundColor: '#d7ff4f',
    borderColor: '#d7ff4f',
  },
  modeIcon: { color: '#9ca3af', fontSize: 17, marginBottom: 5 },
  modeLabel: { color: '#f3f4f6', fontSize: 13, fontFamily: 'Inter_700Bold' },
  modeCount: { color: '#6b7280', fontSize: 10, fontFamily: 'SpaceMono_400Regular', marginTop: 3 },
  modeTextActive: { color: '#0e1417' },
  summaryCard: {
    backgroundColor: '#172026',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3439',
    padding: 14,
    marginTop: 12,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  summaryPurpose: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
    maxWidth: 255,
  },
  statePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statePillReady: { backgroundColor: '#14532d' },
  statePillDegraded: { backgroundColor: '#78350f' },
  stateText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
  signalSummary: { color: '#d1d5db', fontSize: 11, fontFamily: 'SpaceMono_400Regular', marginTop: 12 },
});
