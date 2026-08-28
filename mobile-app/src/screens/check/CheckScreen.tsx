import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';

type SessionRow = {
  id: string;
  vehicleId: string;
  status: string;
  startedAt: number | null;
  endedAt: number | null;
  createdAt: number;
  totalReadings: number;
};

const TERMINAL = new Set(['COMPLETED', 'INTERRUPTED', 'RECOVERABLE', 'FAILED']);

function CandidateCard({ session, onOpen }: { session: SessionRow; onOpen: () => void }) {
  const { vehicle } = useVehicle(session.vehicleId);
  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} testID={`check-session-${session.id}`}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicle}>{vehicle?.alias ?? 'Vehicle'}</Text>
          <Text style={styles.meta}>{new Date(session.startedAt ?? session.createdAt).toLocaleString()}</Text>
        </View>
        <Text style={[styles.status, session.status === 'COMPLETED' ? styles.complete : styles.limited]}>{session.status}</Text>
      </View>
      <Text style={styles.readings}>{session.totalReadings} persisted reading{session.totalReadings === 1 ? '' : 's'}</Text>
      <Text style={styles.open}>Generate / verify Check →</Text>
    </TouchableOpacity>
  );
}

export default function CheckScreen() {
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const { context, loading: contextLoading } = useLocalContext();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!db || !context?.defaultWorkspaceId) {
      if (!contextLoading) setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const rows = await new LiveSessionRepository(db).getRecentSessions(context.defaultWorkspaceId, 50);
      setSessions((rows as SessionRow[]).filter(row => TERMINAL.has(row.status)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load durable sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [context?.defaultWorkspaceId, contextLoading, db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EVIDENCE-FIRST</Text>
        <Text style={styles.title}>Vehicle Check</Text>
        <Text style={styles.subtitle}>Create an immutable report from a persisted Live session. AutoPulse reports what was observed and what was not evaluated.</Text>
      </View>
      {loading || contextLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4ade80" /><Text style={styles.centerText}>Loading evidence…</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyTitle}>No session evidence yet</Text><Text style={styles.centerText}>Complete a real Live session first. Check never manufactures telemetry.</Text></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#4ade80" />} contentContainerStyle={styles.content}>
          {sessions.map(session => (
            <CandidateCard key={session.id} session={session} onOpen={() => navigation.navigate('VehicleCheckReport', { sessionId: session.id, vehicleId: session.vehicleId })} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  eyebrow: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 27, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 7 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  centerText: { color: '#94a3b8', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  emptyTitle: { color: '#f8fafc', fontSize: 19, fontWeight: '800' },
  error: { color: '#fca5a5', textAlign: 'center' },
  retry: { marginTop: 18, borderWidth: 1, borderColor: '#475569', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  retryText: { color: '#e2e8f0', fontWeight: '800' },
  card: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  vehicle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 4 },
  status: { fontSize: 10, fontWeight: '900', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  complete: { color: '#4ade80', borderColor: '#166534' },
  limited: { color: '#fbbf24', borderColor: '#854d0e' },
  readings: { color: '#cbd5e1', fontSize: 12, marginTop: 14 },
  open: { color: '#60a5fa', fontSize: 12, fontWeight: '800', marginTop: 12 },
});
