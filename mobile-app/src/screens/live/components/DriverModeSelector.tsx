import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  DRIVING_MODE_ORDER,
  DRIVING_MODE_PRESENTATION,
  resolveModeDecisionDimensions,
  type AvailableSignal,
  type DrivingMode,
} from '../../../domain/driver-intelligence';

interface Props {
  selectedMode: DrivingMode;
  availableSignals: readonly AvailableSignal[];
  onSelectMode: (mode: DrivingMode) => void;
}

const coverageColor = (coverage: 'COVERED' | 'PARTIAL') => {
  if (coverage === 'COVERED') return '#4ade80';
  return '#f59e0b';
};

const visibleDimensionsForMode = (
  mode: DrivingMode,
  availableSignals: readonly AvailableSignal[],
) => resolveModeDecisionDimensions(mode, availableSignals)
  .filter(dimension => dimension.coverage !== 'UNKNOWN');

const modeState = (
  mode: DrivingMode,
  availableSignals: readonly AvailableSignal[],
) => {
  const allDimensions = resolveModeDecisionDimensions(mode, availableSignals);
  const visibleDimensions = allDimensions.filter(item => item.coverage !== 'UNKNOWN');

  if (visibleDimensions.length === 0) return null;
  if (
    visibleDimensions.length === allDimensions.length &&
    visibleDimensions.every(item => item.coverage === 'COVERED')
  ) return 'READY';

  return 'ADAPTIVE';
};

export function DriverModeSelector({ selectedMode, availableSignals, onSelectMode }: Props) {
  const presentation = DRIVING_MODE_PRESENTATION[selectedMode];
  const dimensions = visibleDimensionsForMode(selectedMode, availableSignals);
  const state = modeState(selectedMode, availableSignals);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>DRIVER MODE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DRIVING_MODE_ORDER.map(mode => {
          const item = DRIVING_MODE_PRESENTATION[mode];
          const active = mode === selectedMode;
          const modeDimensions = visibleDimensionsForMode(mode, availableSignals);
          const modeStatus = modeState(mode, availableSignals);

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
              {modeDimensions.length > 0 && modeStatus ? (
                <Text style={[styles.modeCoverage, active && styles.modeTextActive]}>
                  {modeStatus === 'READY' ? 'Ready' : 'Adaptive'}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {dimensions.length > 0 ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>{presentation.label}</Text>
              <Text style={styles.summaryPurpose}>{presentation.purpose}</Text>
            </View>
            {state ? (
              <View style={[
                styles.statePill,
                state === 'READY' ? styles.statePillReady : styles.statePillAdaptive,
              ]}>
                <Text style={styles.stateText}>{state}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.dimensionGrid}>
            {dimensions.map(dimension => (
              <View key={dimension.id} style={styles.dimensionRow} testID={`decision-dimension-${dimension.id.toLowerCase()}`}>
                <View style={[styles.dimensionDot, { backgroundColor: coverageColor(dimension.coverage) }]} />
                <Text style={styles.dimensionLabel}>{dimension.label}</Text>
                <Text style={[styles.dimensionState, { color: coverageColor(dimension.coverage) }]}>
                  {dimension.coverage === 'COVERED' ? 'READY' : 'PARTIAL'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
  modeCoverage: { color: '#6b7280', fontSize: 10, fontFamily: 'SpaceMono_400Regular', marginTop: 3 },
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
  summaryCopy: { flex: 1 },
  summaryTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  summaryPurpose: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_400Regular',
  },
  statePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statePillReady: { backgroundColor: '#14532d' },
  statePillAdaptive: { backgroundColor: '#78350f' },
  stateText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
  dimensionGrid: { marginTop: 14, gap: 8 },
  dimensionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  dimensionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  dimensionLabel: { flex: 1, color: '#e5e7eb', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  dimensionState: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 0.5 },
});
