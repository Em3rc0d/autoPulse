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

const coverageColor = (coverage: 'COVERED' | 'PARTIAL' | 'UNKNOWN') => {
  if (coverage === 'COVERED') return '#4ade80';
  if (coverage === 'PARTIAL') return '#f59e0b';
  return '#6b7280';
};

const modeState = (dimensions: ReturnType<typeof resolveModeDecisionDimensions>) => {
  const covered = dimensions.filter(item => item.coverage === 'COVERED').length;
  const known = dimensions.filter(item => item.coverage !== 'UNKNOWN').length;
  if (covered === dimensions.length) return 'READY';
  if (known === 0) return 'LIMITED';
  return 'ADAPTIVE';
};

export function DriverModeSelector({ selectedMode, availableSignals, onSelectMode }: Props) {
  const presentation = DRIVING_MODE_PRESENTATION[selectedMode];
  const dimensions = resolveModeDecisionDimensions(selectedMode, availableSignals);
  const state = modeState(dimensions);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>DRIVER MODE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DRIVING_MODE_ORDER.map(mode => {
          const item = DRIVING_MODE_PRESENTATION[mode];
          const active = mode === selectedMode;
          const modeDimensions = resolveModeDecisionDimensions(mode, availableSignals);
          const knownDimensions = modeDimensions.filter(dimension => dimension.coverage !== 'UNKNOWN').length;

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
              <Text style={[styles.modeCoverage, active && styles.modeTextActive]}>
                {knownDimensions === modeDimensions.length ? 'Ready' : knownDimensions > 0 ? 'Adaptive' : 'Limited'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{presentation.label}</Text>
            <Text style={styles.summaryPurpose}>{presentation.purpose}</Text>
          </View>
          <View style={[
            styles.statePill,
            state === 'READY' ? styles.statePillReady : state === 'ADAPTIVE' ? styles.statePillAdaptive : styles.statePillLimited,
          ]}>
            <Text style={styles.stateText}>{state}</Text>
          </View>
        </View>

        <View style={styles.dimensionGrid}>
          {dimensions.map(dimension => (
            <View key={dimension.id} style={styles.dimensionRow} testID={`decision-dimension-${dimension.id.toLowerCase()}`}>
              <View style={[styles.dimensionDot, { backgroundColor: coverageColor(dimension.coverage) }]} />
              <Text style={styles.dimensionLabel}>{dimension.label}</Text>
              <Text style={[styles.dimensionState, { color: coverageColor(dimension.coverage) }]}>
                {dimension.coverage === 'COVERED' ? 'READY' : dimension.coverage === 'PARTIAL' ? 'PARTIAL' : 'UNKNOWN'}
              </Text>
            </View>
          ))}
        </View>
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
  statePillLimited: { backgroundColor: '#374151' },
  stateText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
  dimensionGrid: { marginTop: 14, gap: 8 },
  dimensionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  dimensionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  dimensionLabel: { flex: 1, color: '#e5e7eb', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  dimensionState: { fontSize: 9, fontFamily: 'SpaceMono_700Bold', letterSpacing: 0.5 },
});
