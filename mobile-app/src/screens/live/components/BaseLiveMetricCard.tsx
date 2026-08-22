import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
import { SignalAdvisoryState, SignalSessionStats, SignalAdvisoryProfile, SignalReferenceRange } from '../../../domain/telemetry/SignalAdvisory';

interface Props {
  label: string;
  value: number | null | undefined;
  unit: string;
  state: SignalAdvisoryState;
  stats: SignalSessionStats;
  profile: SignalAdvisoryProfile;
  origin?: string;
  testID?: string;
}

export function LiveMetricCard({ label, value, unit, state, stats, profile, origin, testID }: Props) {
  const [showSheet, setShowSheet] = useState(false);

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

  const formatRange = (r: SignalReferenceRange) => {
    if (r.min !== undefined && r.max !== undefined) {
      return `${r.min}–${r.max} ${r.unit}`;
    }
    if (r.min !== undefined) {
      return `${r.minInclusive === false ? '>' : '>='}${r.min} ${r.unit}`;
    }
    if (r.max !== undefined) {
      return `${r.maxInclusive === false ? '<' : '<='}${r.max} ${r.unit}`;
    }
    return `--`;
  };

  const getReferenceRangeColor = (r: SignalReferenceRange) => {
    if (profile.signalId === 'ENGINE_COOLANT') {
      if (r.displayOrder === 1) return getColor('GREEN');
      if (r.displayOrder === 2) return getColor('ORANGE');
      return getColor('RED');
    }

    if (profile.signalId === 'ENGINE_RPM') {
      if (r.context === 'COLD_START') return getColor('BLUE');
      if (r.context === 'GENERAL') return getColor('GRAY');
      return getColor('GREEN');
    }

    if (profile.signalId === 'VEHICLE_SPEED') {
      if (r.displayOrder === 1) return getColor('GREEN');
      if (r.displayOrder === 2 || r.displayOrder === 3) return getColor('ORANGE');
      return getColor('RED');
    }

    if (profile.signalId === 'CONTROL_VOLTAGE') {
      if (r.context === 'ENGINE_OFF') {
        if (r.displayOrder === 1) return getColor('GREEN');
        if (r.displayOrder === 4) return getColor('RED');
        return getColor('ORANGE');
      }

      if (r.context === 'ENGINE_RUNNING') {
        if (r.displayOrder === 5) return getColor('GREEN');
        if (r.displayOrder === 6 || r.displayOrder === 7) return getColor('ORANGE');
        return getColor('RED');
      }
    }

    return getColor('NEUTRAL');
  };

  const accentColor = state.quality !== 'STALE' && state.quality !== 'UNAVAILABLE'
    ? getColor(state.advisory === 'UNKNOWN' ? 'GRAY' : state.color)
    : '#6b7280';
  let displayValue = '--';
  if (state.quality === 'UNAVAILABLE' || state.quality === 'INVALID') {
    displayValue = 'Unavailable';
  } else if (state.quality === 'SUSPECT') {
    displayValue = 'Sospechoso';
  } else if (value !== null && value !== undefined) {
    displayValue = String(Math.round(value * 10) / 10);
  }

  const validMin = stats.validMinObserved !== null ? String(Math.round(stats.validMinObserved * 10) / 10) : '--';
  const validMax = stats.validMaxObserved !== null ? String(Math.round(stats.validMaxObserved * 10) / 10) : '--';

  const ranges = (profile.referenceRanges || []).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <>
      <TouchableOpacity
        testID={testID}
        style={[
          styles.card,
          {
            borderLeftWidth: 4,
            borderLeftColor: accentColor,
            borderColor: accentColor === '#6b7280' ? 'transparent' : accentColor,
            borderWidth: accentColor === '#6b7280' ? 0 : 1
          }
        ]}
        onPress={() => setShowSheet(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.cardLabel, { color: '#9ca3af' }]}>{label}</Text>
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

      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setShowSheet(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setShowSheet(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetContent}>

              <Text style={styles.sectionHeader}>ACTUAL</Text>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Valor actual recibido</Text>
                <Text style={[styles.sheetValue, { color: accentColor }]}>
                  {displayValue} {state.quality !== 'UNAVAILABLE' && state.quality !== 'SUSPECT' ? unit : ''}
                </Text>
              </View>
              {label === 'Engine RPM' && value === 0 && state.quality === 'VALID' && (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Estado actual</Text>
                  <Text style={styles.sheetValue}>Motor detenido</Text>
                </View>
              )}
              {label !== 'Engine RPM' && stats.engineStoppedObserved && (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Estado durante sesión</Text>
                  <Text style={styles.sheetValue}>Motor detenido</Text>
                </View>
              )}
              {label === 'Engine RPM' && stats.engineStoppedObserved && value !== 0 && (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Estado durante sesión</Text>
                  <Text style={styles.sheetValue}>Motor detenido</Text>
                </View>
              )}
              {state.quality === 'SUSPECT' && (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Detalle técnico</Text>
                  <Text style={styles.sheetValue}>Posible valor mínimo del protocolo</Text>
                </View>
              )}

              <Text style={styles.sectionHeader}>SESSION OBSERVED</Text>
              {stats.validReadingCount === 0 ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Muestras válidas</Text>
                  <Text style={styles.sheetValue}>No valid readings</Text>
                </View>
              ) : (
                <>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Mínimo observado</Text>
                    <Text style={styles.sheetValue}>{validMin} {unit}</Text>
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Máximo observado</Text>
                    <Text style={styles.sheetValue}>{validMax} {unit}</Text>
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Muestras válidas</Text>
                    <Text style={styles.sheetValue}>{stats.validReadingCount}</Text>
                  </View>
                </>
              )}

              <Text style={styles.sectionHeader}>GENERAL REFERENCE</Text>
              {ranges.length === 0 ? (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Rango esperado</Text>
                  <Text style={styles.sheetValue}>No configurado</Text>
                </View>
              ) : (
                Object.entries(
                  ranges.reduce((acc, r) => {
                    const ctxName =
                      r.context === 'GENERAL' ? 'GENERAL' :
                      r.context === 'ENGINE_OFF' ? 'MOTOR APAGADO' :
                      r.context === 'ENGINE_RUNNING' ? 'MOTOR ENCENDIDO' :
                      r.context === 'IDLE' ? 'RALENTÍ' :
                      r.context === 'COLD_START' ? 'ARRANQUE EN FRÍO' :
                      r.context === 'NORMAL_DRIVING' ? 'MARCHA NORMAL' :
                      r.context === 'GASOLINE_ENGINE' ? 'GASOLINA' : r.context;

                    if (!acc[ctxName]) acc[ctxName] = [];
                    acc[ctxName].push(r);
                    return acc;
                  }, {} as Record<string, typeof ranges>)
                ).map(([ctx, ctxRanges]) => (
                  <View key={ctx} style={{ marginBottom: 12 }}>
                    {ctx !== 'GENERAL' && (
                      <Text style={[styles.sheetLabel, { color: '#60a5fa', marginBottom: 4, marginTop: 4, fontSize: 12 }]}>{ctx}</Text>
                    )}
                    {ctxRanges.map((r, idx) => (
                      <View key={idx} style={[styles.sheetRow, { borderBottomWidth: 0, paddingVertical: 4 }]}>
                        <Text style={styles.sheetLabel}>{r.label}</Text>
                        <Text style={[styles.sheetValue, { color: getReferenceRangeColor(r) }]}>{formatRange(r)}</Text>
                      </View>
                    ))}
                  </View>
                ))
              )}

              <Text style={styles.sectionHeader}>CALIBRACIÓN</Text>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Fuente</Text>
                <Text style={styles.sheetValue}>
                  {state.source === 'GENERIC_REFERENCE' ? 'Referencia general' : 'Configuración OEM'}
                </Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Nivel de calibración</Text>
                <Text style={styles.sheetValue}>
                  {state.calibration === 'GENERIC_ONLY' ? 'No específica para este vehículo' : 'Calibración verificada'}
                </Text>
              </View>

              {state.source === 'GENERIC_REFERENCE' && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Advertencia: Los límites OEM del vehículo tienen prioridad.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardLabel: { color: '#9ca3af', fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  originText: { color: '#6b7280', fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  badgesContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoBadge: {
    backgroundColor: '#7c2d12',
    borderColor: '#ea580c',
    borderWidth: 1,
  },
  demoBadgeText: {
    color: '#fed7aa',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  badgeText: {
    color: '#d1d5db',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  bottomSheet: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.8,
    padding: 24,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  closeText: { color: '#60a5fa', fontSize: 16, fontFamily: 'Inter_500Medium' },
  sheetContent: { paddingBottom: 20 },
  sectionHeader: { color: '#4b5563', fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 20, marginBottom: 8 },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  sheetLabel: { color: '#9ca3af', fontSize: 14, fontFamily: 'Inter_500Medium' },
  sheetValue: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  warningBox: { backgroundColor: '#374151', padding: 16, borderRadius: 8, marginTop: 24 },
  warningText: { color: '#fca5a5', fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
