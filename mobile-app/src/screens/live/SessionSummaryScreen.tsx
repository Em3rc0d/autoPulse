import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useSessionSummary } from '../../infrastructure/hooks/useSessionSummary';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { SessionIntegrityState } from '../../domain/telemetry/models/sessionSummaryResult';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { useAppLanguage } from '../../application/i18n/AppLanguage';

export default function SessionSummaryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId, sessionId, duration = 0, isVirtual } = route.params || {};
  const { text } = useAppLanguage();

  const { context } = useLocalContext();
  const workspaceId = context?.defaultWorkspaceId;

  const { vehicle } = useVehicle(vehicleId);
  const { summary, loading, progress, error } = useSessionSummary(workspaceId, sessionId);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  const formatValue = (val: number | null | undefined, precision: number = 0) => {
    if (val === null || val === undefined) return '--';
    return val.toFixed(precision);
  };

  const handleDone = () => {
    navigation.navigate('History');
  };

  const handleCheck = () => {
    const retained = activeBleController.getActiveConnection();
    const canReuse = Boolean(
      retained &&
      retained.vehicleId === vehicleId &&
      activeBleController.getOwner() === 'IDLE'
    );

    navigation.navigate('Check', {
      screen: canReuse ? 'CheckRun' : 'CheckConnect',
      params: canReuse && retained
        ? {
            vehicleId,
            connectionHandleId: retained.connectionHandleId,
            adapterInstanceId: retained.adapterInstanceId,
          }
        : { vehicleId },
    });
  };

  if (isVirtual) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{text("Session Summary", "Resumen de sesión")}</Text>
        </View>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.statusBanner}>
            <View style={[styles.statusIcon, { borderColor: '#60a5fa' }]}>
              <Text style={[styles.statusIconText, { color: '#60a5fa' }]}>✓</Text>
            </View>
            <Text style={styles.subtitle}>{text("Simulation Saved", "Simulación guardada")}</Text>
            <Text style={styles.terminationText}>{text("Development placebo only", "Sólo simulación de desarrollo")}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{text("Identity", "Identidad")}</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>{text("Vehicle:", "Vehículo:")}</Text>
              <Text style={styles.value}>{vehicle ? vehicle.alias : (vehicleId ? vehicleId.substring(0,8) : text('Unknown', 'Desconocido'))}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{text("Session ID:", "ID de sesión:")}</Text>
              <Text style={styles.value}>{sessionId?.substring(0, 8)}...</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{text("Acquisition Mode:", "Modo de adquisición:")}</Text>
              <Text style={[styles.value, { color: '#60a5fa' }]}>VIRTUAL_PREVIEW</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{text("Duration:", "Duración:")}</Text>
              <Text style={styles.value}>{formatTime(duration)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
            <Text style={styles.primaryButtonText}>{text("Done", "Listo")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{text("Session Summary", "Resumen de sesión")}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>{text("Failed to reconstruct session.", "No se pudo reconstruir la sesión.")}</Text>
          <Text style={styles.errorDetails}>{error.message}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
            <Text style={styles.primaryButtonText}>{text("Go Back", "Volver")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading || !summary) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{text("Session Summary", "Resumen de sesión")}</Text>
        </View>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#4ade80" style={{ marginBottom: 16 }} />
          <Text style={styles.subtitle}>{text("Reconstructing session...", "Reconstruyendo sesión...")}</Text>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.loadingDetail}>{text("Reading persisted telemetry", "Leyendo telemetría persistida")}</Text>
        </View>
      </View>
    );
  }

  const getIntegrityColor = (state: SessionIntegrityState) => {
    switch (state) {
      case SessionIntegrityState.COMPLETE: return '#4ade80';
      case SessionIntegrityState.PARTIAL: return '#fbbf24';
      case SessionIntegrityState.DEGRADED: return '#fb923c';
      case SessionIntegrityState.CORRUPTED: return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const isComplete = summary.integrityState === SessionIntegrityState.COMPLETE;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{text("Session Summary", "Resumen de sesión")}</Text>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusBanner}>
          <View style={[styles.statusIcon, { borderColor: getIntegrityColor(summary.integrityState) }]}>
            <Text style={[styles.statusIconText, { color: getIntegrityColor(summary.integrityState) }]}>
              {isComplete ? '✓' : '!'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {isComplete ? text('Session Completed', 'Sesión completada') : `${text('Session', 'Sesión')} ${summary.integrityState}`}
          </Text>
          {summary.terminationReason && (
            <Text style={styles.terminationText}>{text('Reason:', 'Motivo:')} {summary.terminationReason}</Text>
          )}
        </View>

        <View style={styles.checkCallout}>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkEyebrow}>{text("NEXT", "SIGUIENTE")}</Text>
            <Text style={styles.checkTitle}>{text("Run ECU Check", "Ejecutar ECU Check")}</Text>
            <Text style={styles.checkText}>{text("Start a fresh read-only ECU scan. The completed Live session remains immutable.", "Inicia un nuevo escaneo ECU de solo lectura. La sesión Live completada permanece inmutable.")}</Text>
          </View>
          <Text style={styles.checkArrow}>→</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{text("Identity", "Identidad")}</Text>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>{text("Vehicle:", "Vehículo:")}</Text>
            <Text style={styles.value}>{vehicle ? vehicle.alias : vehicleId?.substring(0,8)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{text("Session ID:", "ID de sesión:")}</Text>
            <Text style={styles.value}>{sessionId?.substring(0, 8)}...</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{text("Acquisition Mode:", "Modo de adquisición:")}</Text>
            <Text style={[styles.value, { color: '#60a5fa' }]}>{summary.acquisitionMode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{text("Duration:", "Duración:")}</Text>
            <Text style={styles.value}>{formatTime(summary.durationSeconds || 0)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{text("Persistence & Integrity", "Persistencia e integridad")}</Text>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>{text("Integrity State:", "Estado de integridad:")}</Text>
            <Text style={[styles.value, { color: getIntegrityColor(summary.integrityState) }]}>
              {summary.integrityState}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{text("Total Blocks:", "Bloques totales:")}</Text>
            <Text style={styles.value}>{summary.foundBlocksCount} / {summary.expectedBlocksCount}</Text>
          </View>
          {(summary.partialBlocksCount > 0 || summary.corruptedBlocksCount > 0) && (
            <View style={styles.row}>
              <Text style={styles.label}>{text("Partial / Corrupted:", "Parciales / Corruptos:")}</Text>
              <Text style={styles.value}>{summary.partialBlocksCount} / {summary.corruptedBlocksCount}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>{text("Total Readings:", "Lecturas totales:")}</Text>
            <Text style={styles.value}>{summary.totalReadingsCount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{text("Metrics", "Métricas")}</Text>
          <View style={styles.divider} />

          {Object.values(summary.signalSummaries).length === 0 ? (
            <Text style={styles.noDataText}>{text("No valid readings acquired.", "No se adquirieron lecturas válidas.")}</Text>
          ) : (
            Object.values(summary.signalSummaries).map(sig => (
              <View key={sig.signalId} style={styles.metricBlock}>
                <Text style={styles.metricName}>{text('Signal', 'Señal')} {sig.signalId}</Text>
                {sig.validReadingsCount > 0 ? (
                  <View style={styles.metricStats}>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>{text("Min", "Mín")}</Text>
                      <Text style={styles.statValue}>{formatValue(sig.min, 1)}</Text>
                    </View>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>{text("Avg", "Prom")}</Text>
                      <Text style={styles.statValue}>{formatValue(sig.avg, 1)}</Text>
                    </View>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>{text("Max", "Máx")}</Text>
                      <Text style={styles.statValue}>{formatValue(sig.max, 1)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.statValueDim}>{text("No valid data points.", "Sin puntos de datos válidos.")}</Text>
                )}
                <View style={styles.metricFoot}>
                  <Text style={styles.metricFootText}>{text('Valid:', 'Válidas:')} {sig.validReadingsCount}</Text>
                  <Text style={styles.metricFootText}>{text('No Data:', 'Sin datos:')} {sig.noDataCount}</Text>
                  <Text style={styles.metricFootText}>{text('Invalid:', 'Inválidas:')} {sig.invalidCount}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkButton} onPress={handleCheck} testID="session-summary-open-check">
          <Text style={styles.checkButtonText}>{text("Open Check", "Abrir Check")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleDone}>
          <Text style={styles.secondaryButtonText}>{text("History", "Historial")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1417' },
  header: { padding: 18, paddingTop: 48, backgroundColor: '#1a2227', borderBottomWidth: 1, borderBottomColor: '#2a3439' },
  title: { color: '#fff', fontSize: 22, fontFamily: 'Inter_600SemiBold' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 28 },
  statusBanner: { alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  statusIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', marginBottom: 9, borderWidth: 2 },
  statusIconText: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_500Medium' },
  terminationText: { color: '#9ca3af', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
  checkCallout: { minHeight: 66, flexDirection: 'row', alignItems: 'center', backgroundColor: '#17210d', borderWidth: 1, borderColor: '#4d7c0f', borderRadius: 14, padding: 13, marginBottom: 14 },
  checkEyebrow: { color: '#a3e635', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  checkTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '800', marginTop: 2 },
  checkText: { color: '#94a3b8', fontSize: 10, lineHeight: 14, marginTop: 2 },
  checkArrow: { color: '#d7ff4f', fontSize: 24, marginLeft: 10 },
  card: { width: '100%', backgroundColor: '#1f2937', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#374151', marginBottom: 14 },
  cardTitle: { color: '#f3f4f6', fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  divider: { height: 1, backgroundColor: '#374151', marginVertical: 3 },
  label: { color: '#9ca3af', fontSize: 12, fontFamily: 'Inter_400Regular' },
  value: { color: '#fff', fontSize: 12, fontFamily: 'SpaceMono_400Regular' },
  metricBlock: { backgroundColor: '#111827', borderRadius: 8, padding: 10, marginTop: 9 },
  metricName: { color: '#e5e7eb', fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 7 },
  metricStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  statCol: { alignItems: 'center', flex: 1 },
  statLabel: { color: '#6b7280', fontSize: 10, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  statValue: { color: '#4ade80', fontSize: 14, fontFamily: 'SpaceMono_400Regular' },
  statValueDim: { color: '#9ca3af', fontSize: 12, fontFamily: 'SpaceMono_400Regular', marginBottom: 7 },
  metricFoot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 7 },
  metricFootText: { color: '#6b7280', fontSize: 9, fontFamily: 'SpaceMono_400Regular' },
  noDataText: { color: '#9ca3af', fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic', paddingVertical: 10 },
  footer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1a2227', borderTopWidth: 1, borderTopColor: '#2a3439', flexDirection: 'row', gap: 9 },
  primaryButton: { backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  checkButton: { flex: 1, minHeight: 46, backgroundColor: '#d7ff4f', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkButtonText: { color: '#0b1114', fontSize: 14, fontFamily: 'Inter_700Bold' },
  secondaryButton: { minWidth: 100, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#cbd5e1', fontSize: 12, fontFamily: 'Inter_700Bold' },
  progressText: { color: '#4ade80', fontSize: 24, fontFamily: 'SpaceMono_400Regular', marginTop: 8 },
  loadingDetail: { color: '#9ca3af', fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 },
  errorText: { color: '#ef4444', fontSize: 18, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  errorDetails: { color: '#9ca3af', fontSize: 14, fontFamily: 'SpaceMono_400Regular', marginBottom: 24, textAlign: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
