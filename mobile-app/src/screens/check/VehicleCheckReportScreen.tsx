import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useSessionSummary } from '../../infrastructure/hooks/useSessionSummary';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { loadSessionCompatibilitySnapshot } from '../../application/diagnostics/CompatibilityPersistence';
import { VehicleCheckReportRepository } from '../../infrastructure/database/product/repositories/vehicle-check-report.repository';
import { VehicleCheckReportService, type VehicleCheckReportResult } from '../../application/check/VehicleCheckReportService';
import type { VehicleCheckSignalObservation } from '../../application/check/VehicleCheckReport';

function stateTone(state: VehicleCheckSignalObservation['state']): string {
  switch (state) {
    case 'OBSERVED': return '#4ade80';
    case 'PROBED_NO_DATA': return '#fbbf24';
    case 'INVALID_ONLY': return '#fb923c';
    default: return '#94a3b8';
  }
}

function fmt(value: number | null): string {
  return value === null ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function VehicleCheckReportScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { sessionId, vehicleId } = route.params || {};
  const db = useProductDb();
  const { context, loading: contextLoading } = useLocalContext();
  const workspaceId = context?.defaultWorkspaceId;
  const { vehicle } = useVehicle(vehicleId);
  const { summary, loading: summaryLoading, error: summaryError } = useSessionSummary(workspaceId, sessionId);
  const [result, setResult] = useState<VehicleCheckReportResult | null>(null);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !summary || !workspaceId || !vehicleId) return;
    let cancelled = false;
    const run = async () => {
      setGenerating(true);
      setError(null);
      try {
        const compatibility = await loadSessionCompatibilitySnapshot(sessionId);
        const service = new VehicleCheckReportService(new VehicleCheckReportRepository(db));
        const next = await service.getOrCreate({
          summary,
          compatibility,
          vehicle: {
            vehicleId,
            alias: vehicle?.alias,
            make: vehicle?.make,
            model: vehicle?.model,
            year: vehicle?.year,
          },
        });
        if (!cancelled) setResult(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not generate vehicle check.');
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [db, sessionId, summary, vehicle?.alias, vehicle?.make, vehicle?.model, vehicle?.year, vehicleId, workspaceId]);

  if (contextLoading || summaryLoading || generating || !db) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4ade80" /><Text style={styles.centerText}>Reconstructing and sealing evidence…</Text></View>;
  }
  if (summaryError || error || !result) {
    return <View style={styles.center}><Text style={styles.errorTitle}>Check unavailable</Text><Text style={styles.centerText}>{error ?? summaryError?.message ?? 'Unknown error'}</Text><TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backText}>Back</Text></TouchableOpacity></View>;
  }

  const { snapshot } = result;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backLink}>← Check</Text></TouchableOpacity>
        <Text style={styles.title}>Vehicle Check Report</Text>
        <Text style={styles.subtitle}>Evidence-derived · {result.reusedExisting ? 'immutable report reused' : 'new immutable report'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.banner, snapshot.pilotEligible ? styles.bannerReady : styles.bannerLimited]}>
          <Text style={styles.bannerTitle}>{snapshot.pilotEligible ? 'READY FOR PILOT REVIEW' : 'LIMITED EVIDENCE'}</Text>
          <Text style={styles.bannerText}>Integrity seal {result.verified ? 'verified' : 'not verified'} · this is not a mechanical PASS/FAIL verdict.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle & session</Text>
          <Text style={styles.primary}>{snapshot.vehicle.alias ?? `${snapshot.vehicle.make ?? ''} ${snapshot.vehicle.model ?? ''}`.trim() || snapshot.vehicle.vehicleId}</Text>
          <Text style={styles.muted}>Session {snapshot.sessionId.slice(0, 8)}… · {snapshot.acquisition.mode}</Text>
          <View style={styles.row}><Text style={styles.label}>Session integrity</Text><Text style={styles.value}>{snapshot.evidence.sessionIntegrity}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Persisted readings</Text><Text style={styles.value}>{snapshot.evidence.totalReadingsCount}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Blocks</Text><Text style={styles.value}>{snapshot.evidence.foundBlocksCount}/{snapshot.evidence.expectedBlocksCount}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bounded V1 coverage</Text>
          <Text style={styles.coverage}>{snapshot.coverage.observedPercent}% observed</Text>
          <Text style={styles.muted}>{snapshot.coverage.observedSignals}/{snapshot.coverage.targetSignals} target signals · {snapshot.coverage.probedNoDataSignals} probed/no-data · {snapshot.coverage.notEvaluatedSignals} not evaluated</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Observed signals</Text>
          {snapshot.signals.map(signal => (
            <View key={signal.key} style={styles.signal}>
              <View style={styles.signalHead}>
                <View style={{ flex: 1 }}><Text style={styles.signalName}>{signal.label}</Text><Text style={styles.origin}>{signal.source === 'ECU' ? 'ECU evidence' : 'Adapter measurement'}</Text></View>
                <Text style={[styles.signalState, { color: stateTone(signal.state) }]}>{signal.state}</Text>
              </View>
              {signal.state === 'OBSERVED' ? <Text style={styles.stats}>min {fmt(signal.min)} · avg {fmt(signal.avg)} · max {fmt(signal.max)} {signal.unit}</Text> : null}
              <Text style={styles.counts}>valid {signal.validReadingsCount} · no-data {signal.noDataCount} · invalid {signal.invalidCount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Compatibility evidence</Text>
          <View style={styles.row}><Text style={styles.label}>Characterization</Text><Text style={styles.value}>{snapshot.compatibility.available ? 'AVAILABLE' : 'UNAVAILABLE'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Protocol</Text><Text style={styles.value}>{snapshot.compatibility.protocol}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Standard OBD reachable</Text><Text style={styles.value}>{snapshot.compatibility.standardObdReachable === null ? 'UNKNOWN' : snapshot.compatibility.standardObdReachable ? 'OBSERVED' : 'NOT OBSERVED'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Discovered ECUs</Text><Text style={styles.value}>{snapshot.compatibility.discoveredEcuCount}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Limitations</Text>
          {snapshot.limitations.map((item, index) => <Text key={`${index}-${item}`} style={styles.limitation}>• {item}</Text>)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Integrity</Text>
          <Text style={styles.hashLabel}>SHA-256</Text>
          <Text selectable style={styles.hash}>{result.sha256}</Text>
          <Text style={styles.muted}>Report ID {snapshot.checkId}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  center: { flex: 1, backgroundColor: '#0a0f12', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  centerText: { color: '#94a3b8', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  errorTitle: { color: '#fca5a5', fontSize: 20, fontWeight: '900' },
  backButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: '#475569', borderRadius: 999 },
  backText: { color: '#fff', fontWeight: '800' },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  backLink: { color: '#60a5fa', fontSize: 12, fontWeight: '800' },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#64748b', fontSize: 11, marginTop: 4 },
  content: { padding: 16, paddingBottom: 44 },
  banner: { borderRadius: 14, borderWidth: 1, padding: 15, marginBottom: 12 },
  bannerReady: { backgroundColor: '#0c2317', borderColor: '#166534' },
  bannerLimited: { backgroundColor: '#281d08', borderColor: '#854d0e' },
  bannerTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  bannerText: { color: '#cbd5e1', fontSize: 11, lineHeight: 17, marginTop: 5 },
  card: { backgroundColor: '#121b20', borderRadius: 16, borderWidth: 1, borderColor: '#2a363d', padding: 16, marginBottom: 12 },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '900', marginBottom: 11 },
  primary: { color: '#fff', fontSize: 18, fontWeight: '800' },
  muted: { color: '#64748b', fontSize: 11, lineHeight: 17, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#263139' },
  label: { color: '#94a3b8', flex: 1, fontSize: 12 },
  value: { color: '#e2e8f0', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  coverage: { color: '#4ade80', fontSize: 30, fontWeight: '900' },
  signal: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a363d' },
  signalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  signalName: { color: '#f1f5f9', fontSize: 13, fontWeight: '800' },
  origin: { color: '#64748b', fontSize: 10, marginTop: 2 },
  signalState: { fontSize: 10, fontWeight: '900' },
  stats: { color: '#cbd5e1', fontSize: 12, marginTop: 9 },
  counts: { color: '#64748b', fontSize: 10, marginTop: 5 },
  limitation: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  hashLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  hash: { color: '#93c5fd', fontSize: 10, lineHeight: 16, marginTop: 6, marginBottom: 8 },
});
