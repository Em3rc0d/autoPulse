import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLocalContext } from '../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../infrastructure/hooks/useProductDb';
import { useVehicle } from '../infrastructure/hooks/useVehicle';
import { LiveSessionRepository } from '../infrastructure/database/product/repositories/live-session.repository';

type SessionRow = {
  id: string;
  vehicleId: string;
  status: string;
  startedAt: number | null;
  endedAt: number | null;
  createdAt: number;
  totalBlocks: number;
  totalReadings: number;
  stopReason: string | null;
  failureCode: string | null;
};

const TERMINAL_STATUSES = new Set(['COMPLETED', 'INTERRUPTED', 'RECOVERABLE', 'FAILED']);

function statusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return '#4ade80';
    case 'INTERRUPTED': return '#f59e0b';
    case 'RECOVERABLE': return '#38bdf8';
    case 'FAILED': return '#ef4444';
    case 'ACTIVE': return '#22d3ee';
    default: return '#94a3b8';
  }
}

function formatDuration(startedAt: number | null, endedAt: number | null): string {
  if (!startedAt) return 'Not started';
  if (!endedAt) return 'In progress';
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`;
}

function SessionCard({ session, onOpen }: { session: SessionRow; onOpen: () => void }) {
  const { vehicle } = useVehicle(session.vehicleId);
  const timestamp = session.startedAt ?? session.createdAt;
  const terminal = TERMINAL_STATUSES.has(session.status);
  const reason = session.stopReason || session.failureCode;

  return (
    <TouchableOpacity
      style={[styles.sessionCard, !terminal && styles.sessionCardDisabled]}
      onPress={terminal ? onOpen : undefined}
      activeOpacity={terminal ? 0.8 : 1}
      accessibilityRole={terminal ? 'button' : undefined}
      testID={`history-session-${session.id}`}
    >
      <View style={styles.sessionTopRow}>
        <View style={styles.sessionIdentity}>
          <Text style={styles.vehicleName}>{vehicle?.alias || 'Vehicle'}</Text>
          <Text style={styles.sessionDate}>{new Date(timestamp).toLocaleString()}</Text>
        </View>
        <View style={[styles.statusPill, { borderColor: statusColor(session.status) }]}>
          <Text style={[styles.statusText, { color: statusColor(session.status) }]}>{session.status}</Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>DURATION</Text>
          <Text style={styles.metricValue}>{formatDuration(session.startedAt, session.endedAt)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>BLOCKS</Text>
          <Text style={styles.metricValue}>{session.totalBlocks}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>READINGS</Text>
          <Text style={styles.metricValue}>{session.totalReadings}</Text>
        </View>
      </View>

      {reason ? <Text style={styles.reasonText}>Termination: {reason}</Text> : null}
      <Text style={styles.sessionIdText}>Session {session.id.substring(0, 8)}…</Text>
      {terminal ? <Text style={styles.openHint}>Open reconstructed summary →</Text> : null}
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const db = useProductDb();
  const { context, loading: contextLoading } = useLocalContext();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (refresh = false) => {
    if (!db || !context?.defaultWorkspaceId) {
      if (!contextLoading) setLoading(false);
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const repo = new LiveSessionRepository(db);
      const rows = await repo.getRecentSessions(context.defaultWorkspaceId, 50);
      setSessions(rows as SessionRow[]);
    } catch (err) {
      console.error('[HistoryScreen] Failed to load sessions:', err);
      setError(err instanceof Error ? err.message : 'Could not load session history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [context?.defaultWorkspaceId, contextLoading, db]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions])
  );

  const openSummary = (session: SessionRow) => {
    navigation.navigate('Live', {
      screen: 'SessionSummary',
      params: {
        vehicleId: session.vehicleId,
        sessionId: session.id,
        isVirtual: false,
      },
    });
  };

  const startLive = () => {
    navigation.navigate('Garage');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DURABLE EVIDENCE</Text>
        <Text style={styles.headerTitle}>Session History</Text>
        <Text style={styles.headerSub}>Completed and interrupted Live sessions persisted on this device.</Text>
      </View>

      {loading || contextLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#00D1FF" />
          <Text style={styles.stateText}>Loading persisted sessions…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>History unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadSessions()}>
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>No persisted sessions yet</Text>
          <Text style={styles.emptyText}>
            Complete a real Live session and AutoPulse will keep its durable summary here.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={startLive}>
            <Text style={styles.primaryButtonText}>Go to Garage</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadSessions(true)}
              tintColor="#00D1FF"
            />
          )}
        >
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{sessions.length} recent session{sessions.length === 1 ? '' : 's'}</Text>
            <Text style={styles.summaryHint}>Pull to refresh</Text>
          </View>

          {sessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              onOpen={() => openSummary(session)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E11' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#20282d',
    backgroundColor: '#10161a',
  },
  eyebrow: {
    color: '#00D1FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: '#8E9BA3', fontSize: 13, lineHeight: 18, marginTop: 5 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  stateText: { color: '#8E9BA3', fontSize: 14, marginTop: 14 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#8E9BA3', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  errorTitle: { color: '#ef4444', fontSize: 20, fontWeight: '800' },
  errorText: { color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  primaryButton: { backgroundColor: '#00D1FF', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 24 },
  primaryButtonText: { color: '#071013', fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  secondaryButtonText: { color: '#e2e8f0', fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  summaryHint: { color: '#64748b', fontSize: 11 },
  sessionCard: {
    backgroundColor: '#121a1f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#29343a',
    padding: 16,
    marginBottom: 12,
  },
  sessionCardDisabled: { opacity: 0.78 },
  sessionTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sessionIdentity: { flex: 1 },
  vehicleName: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  sessionDate: { color: '#7f8d96', fontSize: 12, marginTop: 3 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 15 },
  metricCell: { flex: 1, backgroundColor: '#0d1317', borderRadius: 10, padding: 10 },
  metricLabel: { color: '#64748b', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  metricValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '800', marginTop: 4 },
  reasonText: { color: '#fbbf24', fontSize: 11, marginTop: 12 },
  sessionIdText: { color: '#52616a', fontSize: 10, marginTop: 10 },
  openHint: { color: '#00D1FF', fontSize: 11, fontWeight: '800', marginTop: 8 },
});
