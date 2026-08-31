import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  DRIVING_MODE_ORDER,
  DRIVING_MODE_PRESENTATION,
  resolveModeDecisionDimensions,
  type AvailableSignal,
  type DecisionDimensionCoverage,
  type DrivingMode,
} from '../../../domain/driver-intelligence';

interface Props {
  selectedMode: DrivingMode;
  availableSignals: readonly AvailableSignal[];
  onSelectMode: (mode: DrivingMode) => void;
  disabled?: boolean;
}

const coverageColor = (coverage: DecisionDimensionCoverage) => {
  if (coverage === 'COVERED') return '#4ade80';
  if (coverage === 'PARTIAL') return '#f59e0b';
  return '#6b7280';
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

export function DriverModeSelector({ selectedMode, availableSignals, onSelectMode, disabled = false }: Props) {
  const presentation = DRIVING_MODE_PRESENTATION[selectedMode];
  const dimensions = visibleDimensionsForMode(selectedMode, availableSignals);
  const state = modeState(selectedMode, availableSignals);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.modeIdentity}>
          <Text style={styles.eyebrow}>DRIVER MODE</Text>
          <Text style={styles.activeMode}>{presentation.label}</Text>
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

      <View style={styles.row}>
        {DRIVING_MODE_ORDER.map(mode => {
          const item = DRIVING_MODE_PRESENTATION[mode];
          const active = mode === selectedMode;
          return (
            <TouchableOpacity
              key={mode}
              testID={`driver-mode-${mode.toLowerCase()}`}
              style={[styles.modeButton, active && styles.modeButtonActive, disabled && styles.modeButtonDisabled]}
              onPress={() => !disabled && onSelectMode(mode)}
              activeOpacity={0.82}
              disabled={disabled}
            >
              <Text style={[styles.modeIcon, active && styles.modeTextActive]}>{item.icon}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.modeLabel, active && styles.modeTextActive]}>{item.shortLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {dimensions.length > 0 ? (
        <View style={styles.dimensionStrip}>
          {dimensions.map(dimension => (
            <View key={dimension.id} style={styles.dimensionChip} testID={`decision-dimension-${dimension.id.toLowerCase()}`}>
              <View style={[styles.dimensionDot, { backgroundColor: coverageColor(dimension.coverage) }]} />
              <Text numberOfLines={1} style={styles.dimensionLabel}>{dimension.label}</Text>
              <Text style={[styles.dimensionState, { color: coverageColor(dimension.coverage) }]}>
                {dimension.coverage === 'COVERED' ? 'READY' : 'PARTIAL'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modeIdentity: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  eyebrow: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  activeMode: {
    color: '#f8fafc',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  row: { flexDirection: 'row', gap: 4 },
  modeButton: {
    flex: 1,
    minWidth: 0,
    height: 42,
    backgroundColor: '#172026',
    borderColor: '#2a3439',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#d7ff4f',
    borderColor: '#d7ff4f',
  },
  modeButtonDisabled: { opacity: 0.45 },
  modeIcon: { color: '#94a3b8', fontSize: 12, lineHeight: 14 },
  modeLabel: { width: '100%', textAlign: 'center', color: '#e5e7eb', fontSize: 8, fontFamily: 'Inter_700Bold', marginTop: 1 },
  modeTextActive: { color: '#0e1417' },
  statePill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  statePillReady: { backgroundColor: '#14532d' },
  statePillAdaptive: { backgroundColor: '#78350f' },
  stateText: { color: '#fff', fontSize: 7, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  dimensionStrip: { paddingTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dimensionChip: {
    minHeight: 24,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#263239',
    backgroundColor: '#11191d',
    paddingHorizontal: 7,
  },
  dimensionDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  dimensionLabel: { color: '#cbd5e1', fontSize: 8, fontFamily: 'Inter_600SemiBold' },
  dimensionState: { marginLeft: 4, fontSize: 7, fontFamily: 'SpaceMono_700Bold', letterSpacing: 0.2 },
});
