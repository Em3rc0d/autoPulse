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
  compact?: boolean;
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

export function DriverModeSelector({ selectedMode, availableSignals, onSelectMode, disabled = false, compact = false }: Props) {
  const presentation = DRIVING_MODE_PRESENTATION[selectedMode];
  const dimensions = visibleDimensionsForMode(selectedMode, availableSignals);
  const state = modeState(selectedMode, availableSignals);

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <Text style={styles.compactEyebrow}>MODE</Text>
        <TouchableOpacity
          style={styles.compactButton}
          onPress={() => {
            if (disabled) return;
            const index = DRIVING_MODE_ORDER.indexOf(selectedMode);
            onSelectMode(DRIVING_MODE_ORDER[(index + 1) % DRIVING_MODE_ORDER.length]);
          }}
          disabled={disabled}
          testID="driver-mode-compact-selector"
        >
          <Text style={styles.compactIcon}>{presentation.icon}</Text>
          <Text style={styles.compactLabel}>{presentation.shortLabel}</Text>
          <Text style={styles.compactChevron}>›</Text>
        </TouchableOpacity>
        {state ? <Text style={[styles.compactState, { color: state === 'READY' ? '#4ade80' : '#f59e0b' }]}>{state}</Text> : null}
      </View>
    );
  }

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

      <View style={styles.modeGrid}>
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
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.modeLabel, active && styles.modeTextActive]}>{item.shortLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {dimensions.length > 0 ? (
        <View style={styles.dimensionGrid}>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  modeIdentity: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  eyebrow: { color: '#64748b', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  activeMode: { color: '#f8fafc', fontSize: 13, fontFamily: 'Inter_700Bold' },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modeButton: {
    flexGrow: 1,
    flexBasis: '30%',
    height: 39,
    backgroundColor: '#172026',
    borderColor: '#2a3439',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: { backgroundColor: '#d7ff4f', borderColor: '#d7ff4f' },
  modeButtonDisabled: { opacity: 0.45 },
  modeIcon: { color: '#94a3b8', fontSize: 12 },
  modeLabel: { color: '#e5e7eb', fontSize: 9, fontFamily: 'Inter_700Bold', maxWidth: 74 },
  modeTextActive: { color: '#0e1417' },
  statePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statePillReady: { backgroundColor: '#14532d' },
  statePillAdaptive: { backgroundColor: '#78350f' },
  stateText: { color: '#fff', fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  dimensionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingTop: 7 },
  dimensionChip: {
    maxWidth: '49%',
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#263239',
    backgroundColor: '#11191d',
    paddingHorizontal: 7,
  },
  dimensionDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  dimensionLabel: { color: '#cbd5e1', fontSize: 8, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  dimensionState: { marginLeft: 4, fontSize: 7, fontFamily: 'SpaceMono_700Bold', letterSpacing: 0.2 },
  compactRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactEyebrow: { color: '#64748b', fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  compactButton: { flex: 1, height: 34, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#2a3439', backgroundColor: '#151d21', paddingHorizontal: 10 },
  compactIcon: { color: '#d7ff4f', marginRight: 7 },
  compactLabel: { color: '#f8fafc', fontSize: 11, fontFamily: 'Inter_700Bold', flex: 1 },
  compactChevron: { color: '#64748b', fontSize: 18 },
  compactState: { fontSize: 8, fontFamily: 'SpaceMono_700Bold' },
});
