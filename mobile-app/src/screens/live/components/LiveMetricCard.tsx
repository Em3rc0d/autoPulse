import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SignalAdvisoryState, SignalSessionStats, SignalAdvisoryProfile } from '../../../domain/telemetry/SignalAdvisory';

interface Props {
  label: string;
  value: number | null | undefined;
  unit: string;
  state: SignalAdvisoryState;
  stats: SignalSessionStats;
  profile: SignalAdvisoryProfile;
  origin?: string;
  testID?: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function LiveMetricCard({ label, value, unit, state, stats, profile, origin, testID, isSelected, onSelect }: Props) {
  const getColor = (colorState: SignalAdvisoryState['color']) => {
    switch (colorState) {
      case 'BLUE': return '#60a5fa';
      case 'GREEN': return '#4ade80';
      case 'ORANGE': return '#f59e0b';
      case 'RED': return '#ef4444';
      case 'NEUTRAL': return '#e5e7eb';
      case 'GRAY':
      default: return '#6b7280';
    }
  };

  const accentColor = state.quality !== 'STALE' && state.quality !== 'UNAVAILABLE'
    ? getColor(state.advisory === 'UNKNOWN' ? 'GRAY' : state.color)
    : '#6b7280';
    
  let displayValue = '--';
  if (state.quality === 'UNAVAILABLE' || state.quality === 'INVALID') {
    displayValue = 'Unavailable';
  } else if (value !== null && value !== undefined) {
    displayValue = String(Math.round(value * 10) / 10);
  }

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.card,
        isSelected && {
          borderColor: accentColor === '#6b7280' ? '#9ca3af' : accentColor,
          borderWidth: 2,
        },
        !isSelected && {
          borderColor: '#374151',
          borderWidth: 1
        }
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <Text style={[styles.cardLabel, { color: isSelected ? '#d1d5db' : '#9ca3af' }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: accentColor === '#6b7280' ? '#fff' : accentColor }]}>
        {displayValue} {state.quality !== 'UNAVAILABLE' && state.quality !== 'SUSPECT' && state.quality !== 'INVALID' ? unit : ''}
      </Text>
      {origin && <Text style={styles.originText}>{origin}</Text>}

      <View style={styles.badgesContainer}>
        {state.badgeText ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{state.badgeText}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 4, letterSpacing: 1 },
  cardValue: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  originText: { color: '#6b7280', fontSize: 10, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  badgesContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#374151',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#d1d5db',
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  }
});
