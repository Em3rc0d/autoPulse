import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useSessionSummary } from '../../infrastructure/hooks/useSessionSummary';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { SessionIntegrityState } from '../../domain/telemetry/models/sessionSummaryResult';

export default function SessionSummaryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId, sessionId, duration = 0, isVirtual } = route.params || {};

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
    navigation.navigate('Check', {
      screen: 'VehicleCheckReport',
      params: { sessionId, vehicleId },
    });
  };

  if (isVirtual) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Session Summary</Text>
        </View>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.statusBanner}>
            <View style={[styles.statusIcon, { borderColor: '#60a5fa' }]}>
              <Text style={[styles.statusIconText, { color: '#60a5fa' }]}>✓</Text>
            </View>
            <Text style={styles.subtitle}>Simulation Saved</Text>
            <Text style={styles.terminationText}>Development placebo only</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identity</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Vehicle:</Text>
              <Text style={styles.value}>{vehicle ? vehicle.alias : (vehicleId ? vehicleId.substring(0,8) : 'Unknown')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Session ID:</Text>
              <Text style={styles.value}>{sessionId?.substring(0, 8)}...</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Acquisition Mode:</Text>
              <Text style={[styles.value, { color: '#60a5fa' }]}>VIRTUAL_PREVIEW</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Duration:</Text>
              <Text style={styles.value}>{formatTime(duration)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Session Summary</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>Failed to reconstruct session.</Text>
          <Text style={styles.errorDetails}>{error.message}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading || !summary) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Session Summary</Text>
        </View>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#4ade80" style={{ marginBottom: 16 }} />
          <Text style={styles.subtitle}>Reconstructing session...</Text>
          <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.loadingDetail}>Reading persisted telemetry</Text>
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
        <Text style={styles.title}>Session Summary</Text>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusBanner}>
          <View style={[styles.statusIcon, { borderColor: getIntegrityColor(summary.integrityState) }]}>
            <Text style={[styles.statusIconText, { color: getIntegrityColor(summary.integrityState) }]}>
              {isComplete ? '✓' : '!'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {isComplete ? 'Session Completed' : `Session ${summary.integrityState}`}
          </Text>
          {summary.terminationReason && (
            <Text style={styles.terminationText}>Reason: {summary.terminationReason}</Text>
          )}
        </View>

        <View style={styles.checkCallout}>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkEyebrow}>NEXT</Text>
            <Text style={styles.checkTitle}>Review with Check</Text>
            <Text style={styles.checkText}>Build a sealed evidence report from this exact persisted session.</Text>
          </View>
          <Text style={styles.checkArrow}>→</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identity</Text>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Vehicle:</Text>
            <Text style={styles.value}>{vehicle ? vehicle.alias : vehicleId?.substring(0,8)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session ID:</Text>
            <Text style={styles.value}>{sessionId?.substring(0, 8)}...</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Acquisition Mode:</Text>
            <Text style={[styles.value, { color: '#60a5fa' }]}>{summary.acquisitionMode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duration:</Text>
            <Text style={styles.value}>{formatTime(summary.durationSeconds || 0)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Persistence & Integrity</Text>
          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Integrity State:</Text>
            <Text style={[styles.value, { color: getIntegrityColor(summary.integrityState) }]}>
              {summary.integrityState}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Blocks:</Text>
            <Text style={styles.value}>{summary.foundBlocksCount} / {summary.expectedBlocksCount}</Text>
          </View>
          {(summary.partialBlocksCount > 0 || summary.corruptedBlocksCount > 0) && (
            <View style={styles.row}>
              <Text style={styles.label}>Partial / Corrupted:</Text>
              <Text style={styles.value}>{summary.partialBlocksCount} / {summary.corruptedBlocksCount}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Total Readings:</Text>
            <Text style={styles.value}>{summary.totalReadingsCount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Metrics</Text>
          <View style={styles.divider} />

          {Object.values(summary.signalSummaries).length === 0 ? (
            <Text style={styles.noDataText}>No valid readings acquired.</Text>
          ) : (
            Object.values(summary.signalSummaries).map(sig => (
              <View key={sig.signalId} style={styles.metricBlock}>
                <Text style={styles.metricName}>Signal {sig.signalId}</Text>
                {sig.validReadingsCount > 0 ? (
                  <View style={styles.metricStats}>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Min</Text>
                      <Text style={styles.statValue}>{formatValue(sig.min, 1)}</Text>
                    </View>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Avg</Text>
                      <Text style={styles.statValue}>{formatValue(sig.avg, 1)}</Text>
                    </View>
                    <View style={styles.statCol}>
                      <Text style={styles.statLabel}>Max</Text>
                      <Text style={styles.statValue}>{formatValue(sig.max, 1)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.statValueDim}>No valid data points.</Text>
                )}
                <View style={styles.metricFoot}>
                  <Text style={styles.metricFootText}>Valid: {sig.validReadingsCount}</Text>
                  <Text style={styles.metricFootText}>No Data: {sig.noDataCount}</Text>
                  <Text style={styles.metricFootText}>Invalid: {sig.invalidCount}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkButton} onPress={handleCheck} testID="session-summary-open-check">
          <Text style={styles.checkButtonText}>Open Check</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleDone}>
          <Text style={styles.secondaryButtonText}>History</Text>
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
