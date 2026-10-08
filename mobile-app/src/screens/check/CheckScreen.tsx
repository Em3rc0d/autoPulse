import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../../infrastructure/hooks/useVehicles';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { DiagnosticCheckReportRepository } from '../../infrastructure/database/product/repositories/diagnostic-check-report.repository';
import type { StoredDiagnosticCheckReport, DiagnosticCheckSnapshot } from '../../application/check/DiagnosticCheckReport';

export default function CheckScreen() {
  const navigation = useNavigation<any>();
  const { vehicles, loading, error, refresh } = useVehicles();
  const db = useProductDb();
  const { context } = useLocalContext();
  const workspaceId = context?.defaultWorkspaceId as string | undefined;
  const [recentChecks, setRecentChecks] = useState<StoredDiagnosticCheckReport[]>([]);

  useEffect(() => {
    if (!db || !workspaceId) return;
    let mounted = true;
    new DiagnosticCheckReportRepository(db).getRecent(workspaceId, 8)
      .then(rows => { if (mounted) setRecentChecks(rows); })
      .catch(reason => console.warn('[CheckScreen] Could not load recent sealed checks', reason));
    return () => { mounted = false; };
  }, [db, workspaceId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ECU DIAGNOSTICS · READ ONLY</Text>
        <Text style={styles.title}>Check</Text>
        <Text style={styles.subtitle}>Ask the vehicle's ECU what diagnostic evidence it reports now. No prior Live session is required.</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4ade80" /><Text style={styles.centerText}>Loading vehicles…</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>Could not load Garage vehicles.</Text><TouchableOpacity style={styles.secondary} onPress={() => void refresh()}><Text style={styles.secondaryText}>Retry</Text></TouchableOpacity></View>
      ) : vehicles.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyTitle}>Add a vehicle first</Text><Text style={styles.centerText}>Check needs a Garage vehicle for report context, but it does not need a Live session.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Adaptive read-only Check</Text>
            <Text style={styles.noticeText}>Park before starting. AutoPulse reads standard DTC services, emissions readiness and a bounded vehicle-data snapshot selected from proven read-only PID decoders. It adapts to ECU evidence without sweeping the full PID wallet.</Text>
          </View>

          <Text style={styles.section}>Choose vehicle</Text>
          {vehicles.map((vehicle: any) => (
            <TouchableOpacity
              key={vehicle.id}
              style={styles.card}
              onPress={() => navigation.navigate('CheckConnect', { vehicleId: vehicle.id })}
              testID={`check-vehicle-${vehicle.id}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicle}>{vehicle.alias || 'Vehicle'}</Text>
                <Text style={styles.meta}>{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'Garage vehicle'}</Text>
              </View>
              <Text style={styles.open}>Run Check →</Text>
            </TouchableOpacity>
          ))}

          {recentChecks.length > 0 ? (
            <>
              <Text style={[styles.section, { marginTop: 18 }]}>Recent sealed Checks</Text>
              {recentChecks.map(item => {
                let snapshot: DiagnosticCheckSnapshot | null = null;
                try { snapshot = JSON.parse(item.snapshotJson) as DiagnosticCheckSnapshot; } catch {}
                const label = snapshot?.vehicle.alias
                  ?? ([snapshot?.vehicle.make, snapshot?.vehicle.model, snapshot?.vehicle.year].filter(Boolean).join(' ') || 'Vehicle');
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.reportCard}
                    onPress={() => navigation.navigate('DiagnosticCheckReport', { checkId: item.id })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehicle}>{label}</Text>
                      <Text style={styles.meta}>{item.protocol} · {new Date(item.generatedAt).toLocaleString()}</Text>
                    </View>
                    <Text style={styles.sealed}>SEALED →</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}

          <View style={styles.boundary}>
            <Text style={styles.boundaryTitle}>What this is not</Text>
            <Text style={styles.boundaryText}>Check does not create a mechanical PASS/FAIL verdict. No DTCs reported by scanned services does not mean the whole vehicle is healthy. ABS, SRS, transmission and manufacturer-enhanced modules are not inferred.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  eyebrow: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: '#fff', fontSize: 31, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 7 },
  content: { padding: 18, paddingBottom: 52 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  centerText: { color: '#94a3b8', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  emptyTitle: { color: '#f8fafc', fontSize: 19, fontWeight: '800' },
  error: { color: '#fca5a5', fontWeight: '800' },
  notice: { backgroundColor: '#0c2a1a', borderWidth: 1, borderColor: '#166534', borderRadius: 16, padding: 16, marginBottom: 22 },
  noticeTitle: { color: '#4ade80', fontSize: 15, fontWeight: '900' },
  noticeText: { color: '#cbd5e1', lineHeight: 20, marginTop: 7 },
  section: { color: '#e2e8f0', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 12 },
  reportCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0c2317', borderWidth: 1, borderColor: '#166534', borderRadius: 16, padding: 14, marginBottom: 10 },
  sealed: { color: '#86efac', fontSize: 10, fontWeight: '900' },
  vehicle: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 5 },
  open: { color: '#60a5fa', fontSize: 12, fontWeight: '900' },
  boundary: { borderTopWidth: 1, borderTopColor: '#263139', marginTop: 16, paddingTop: 18 },
  boundaryTitle: { color: '#fbbf24', fontWeight: '900', fontSize: 14 },
  boundaryText: { color: '#94a3b8', lineHeight: 20, marginTop: 7 },
  secondary: { marginTop: 18, borderWidth: 1, borderColor: '#475569', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  secondaryText: { color: '#e2e8f0', fontWeight: '800' },
});
