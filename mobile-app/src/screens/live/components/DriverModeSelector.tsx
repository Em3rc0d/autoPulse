import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  disabled?: boolean;
  compact?: boolean;
}

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
  const dimensions = resolveModeDecisionDimensions(selectedMode, availableSignals)
    .filter(dimension => dimension.coverage !== 'UNKNOWN');
  const state = modeState(selectedMode, availableSignals);
  const readyCount = dimensions.filter(item => item.coverage === 'COVERED').length;
  const partialCount = dimensions.filter(item => item.coverage === 'PARTIAL').length;

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
        {dimensions.length > 0 ? (
          <Text style={styles.coverageSummary}>
            <Text style={styles.readyText}>{readyCount} READY</Text>
            {partialCount > 0 ? <Text style={styles.partialText}> · {partialCount} PARTIAL</Text> : null}
          </Text>
        ) : state ? <Text style={styles.coverageSummary}>{state}</Text> : null}
      </View>

      <View style={styles.modeRow}>
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
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.modeLabel, active && styles.modeTextActive]}>{item.shortLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 5 },
  headerRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  modeIdentity: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 },
  eyebrow: { color: '#64748b', fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  activeMode: { color: '#f8fafc', fontSize: 11, fontFamily: 'Inter_700Bold' },
  coverageSummary: { color: '#94a3b8', fontSize: 7, fontFamily: 'SpaceMono_700Bold', marginLeft: 8 },
  readyText: { color: '#4ade80' },
  partialText: { color: '#f59e0b' },
  modeRow: { flexDirection: 'row', gap: 5 },
  modeButton: {
    flex: 1,
    minWidth: 0,
    height: 36,
    backgroundColor: '#172026',
    borderColor: '#2a3439',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: { backgroundColor: '#d7ff4f', borderColor: '#d7ff4f' },
  modeButtonDisabled: { opacity: 0.45 },
  modeIcon: { color: '#94a3b8', fontSize: 11, lineHeight: 12 },
  modeLabel: { color: '#e5e7eb', fontSize: 7.5, fontFamily: 'Inter_700Bold', marginTop: 2, maxWidth: '100%' },
  modeTextActive: { color: '#0e1417' },
  compactRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7 },
  compactEyebrow: { color: '#64748b', fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  compactButton: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#2a3439', backgroundColor: '#151d21', paddingHorizontal: 9 },
  compactIcon: { color: '#d7ff4f', marginRight: 6 },
  compactLabel: { color: '#f8fafc', fontSize: 10, fontFamily: 'Inter_700Bold', flex: 1 },
  compactChevron: { color: '#64748b', fontSize: 17 },
});
