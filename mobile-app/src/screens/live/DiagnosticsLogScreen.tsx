import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextStyle } from 'react-native';
import {
  DiagnosticsBuffer,
  type DiagnosticCommandLogEntry,
} from '../../infrastructure/ble/real/DiagnosticsBuffer';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';

interface DiagnosticsLogScreenProps {
  onClose: () => void;
}

type LinkState = 'CHECKING' | 'CONNECTED' | 'DISCONNECTED' | 'NO LINK' | 'UNKNOWN';

const PID_LABELS: Readonly<Record<string, string>> = {
  '010C': 'RPM',
  '010D': 'SPEED',
  '0105': 'COOLANT',
  '0104': 'ENGINE LOAD',
  '0111': 'THROTTLE',
  '0142': 'ECU VOLTAGE',
  'ATRV': 'ADAPTER VOLTAGE',
};

const ECU_PROGRESS = new Set(['SUCCESS_DECODED', 'SUCCESS_RAW', 'NO_DATA']);
const ECU_FAILURE = new Set(['TIMEOUT', 'WRITE_FAILED', 'DISCONNECTED', 'ELM_ERROR', 'INVALID_RESPONSE', 'PARTIAL', 'CANCELLED']);

const getStatusStyle = (status: string): TextStyle => ({
  color: status.includes('SUCCESS') ? '#4cd137' : (status === 'NO_DATA' || status === 'TIMEOUT' ? '#fbc531' : '#e84118'),
  fontWeight: 'bold',
});

const formatObservedAt = (observedAt: number | null | undefined) =>
  observedAt ? new Date(observedAt).toLocaleTimeString() : '—';

function deriveElmState(logs: readonly DiagnosticCommandLogEntry[]) {
  if (logs.length === 0) return 'NO EVIDENCE';
  const recent = logs.slice(-30);
  const promptObserved = recent.some(log => log.normalizedResponse?.promptDetected);
  const adapterResponseObserved = recent.some(log =>
    ECU_PROGRESS.has(log.status)
    || log.status === 'ELM_ERROR'
    || log.status === 'INVALID_RESPONSE'
    || log.status === 'PARTIAL'
  );
  return promptObserved || adapterResponseObserved ? 'RESPONSIVE' : 'DEGRADED';
}

function deriveEcuPath(logs: readonly DiagnosticCommandLogEntry[]) {
  const recent = logs
    .filter(log => log.request.family === 'OBD_MODE_01')
    .slice(-30);
  if (recent.length === 0) return 'NO EVIDENCE';

  const hasProgress = recent.some(log => ECU_PROGRESS.has(log.status));
  const hasFailure = recent.some(log => ECU_FAILURE.has(log.status));
  if (hasProgress && hasFailure) return 'INTERMITTENT';
  if (hasProgress) return 'RESPONSIVE';
  return 'DEGRADED';
}

export const DiagnosticsLogScreen: React.FC<DiagnosticsLogScreenProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<DiagnosticCommandLogEntry[]>([]);
  const [bleState, setBleState] = useState<LinkState>('CHECKING');

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const nextLogs = DiagnosticsBuffer.getHistory();
      if (mounted) setLogs(nextLogs);

      const connection = activeBleController.getActiveConnection();
      if (!connection) {
        if (mounted) setBleState('NO LINK');
        return;
      }

      try {
        const connected = await connection.device.isConnected();
        if (mounted) setBleState(connected ? 'CONNECTED' : 'DISCONNECTED');
      } catch {
        if (mounted) setBleState('UNKNOWN');
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const commandSummaries = useMemo(() => Object.entries(PID_LABELS).map(([command, label]) => {
    const commandLogs = logs.filter(log => log.request.command.toUpperCase() === command);
    if (commandLogs.length === 0) return null;
    const latest = commandLogs[commandLogs.length - 1];
    const lastSuccess = [...commandLogs].reverse().find(log => log.status === 'SUCCESS_DECODED' || log.status === 'SUCCESS_RAW');
    return { command, label, latest, lastSuccess };
  }).filter(Boolean) as Array<{
    command: string;
    label: string;
    latest: DiagnosticCommandLogEntry;
    lastSuccess?: DiagnosticCommandLogEntry;
  }>, [logs]);

  const elmState = deriveElmState(logs);
  const ecuPath = deriveEcuPath(logs);

  const handleClear = () => {
    DiagnosticsBuffer.clear();
    setLogs([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>OBD Diagnostics</Text>
          <Text style={styles.subtitle}>Physical command outcomes · newest evidence updates every second</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleClear} style={[styles.button, styles.clearButton]}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.button, styles.closeButton]}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
        <View style={styles.linkPanel}>
          <Text style={styles.sectionTitle}>PATH HEALTH</Text>
          <Text style={styles.healthLine}>BLE: <Text style={styles.healthValue}>{bleState}</Text></Text>
          <Text style={styles.healthLine}>ELM: <Text style={styles.healthValue}>{elmState}</Text></Text>
          <Text style={styles.healthLine}>ECU path: <Text style={styles.healthValue}>{ecuPath}</Text></Text>
        </View>

        {commandSummaries.length > 0 ? (
          <View style={styles.summaryPanel}>
            <Text style={styles.sectionTitle}>SIGNAL GAP SUMMARY</Text>
            {commandSummaries.map(summary => (
              <View key={summary.command} style={styles.summaryRow}>
                <Text style={styles.summaryCommand}>{summary.command} {summary.label}</Text>
                <Text style={styles.summaryText}>
                  last success: {formatObservedAt(summary.lastSuccess?.observedAt)}
                </Text>
                <Text style={styles.summaryText}>
                  latest: {formatObservedAt(summary.latest.observedAt)} · {summary.latest.status}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No diagnostic logs yet.</Text>
        ) : (
          [...logs].reverse().map((log, index) => (
            <View key={`${log.request.id || index}-${log.observedAt}`} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <View style={styles.logHeaderCopy}>
                  <Text style={styles.commandText}>
                    {log.request.command} {PID_LABELS[log.request.command.toUpperCase()] ? `· ${PID_LABELS[log.request.command.toUpperCase()]}` : ''}
                  </Text>
                  <Text style={styles.timestampText}>{formatObservedAt(log.observedAt)} · {log.request.family}</Text>
                </View>
                <Text style={getStatusStyle(log.status)}>{log.status}</Text>
              </View>

              <Text style={styles.detailLabel}>Latency</Text>
              <Text style={styles.detailText}>{log.latencyMs} ms</Text>

              <Text style={styles.detailLabel}>Raw input</Text>
              <Text style={styles.detailText}>{log.rawResponse?.accumulatedText.replace(/\r/g, '\\r').replace(/\n/g, '\\n') || 'N/A'}</Text>

              {log.normalizedResponse ? (
                <>
                  <Text style={styles.detailLabel}>Normalized</Text>
                  <Text style={styles.detailText}>{log.normalizedResponse.normalizedText || '(empty)'}</Text>
                </>
              ) : null}

              {log.decodedValues.length > 0 ? (
                <>
                  <Text style={styles.detailLabel}>Decoded</Text>
                  {log.decodedValues.map((val, i) => (
                    <Text key={i} style={styles.detailText}>
                      {val.type}: {JSON.stringify(val.value)} {val.unit}
                    </Text>
                  ))}
                </>
              ) : null}

              {log.errors.length > 0 ? (
                <>
                  <Text style={styles.detailLabel}>Errors</Text>
                  {log.errors.map((err, i) => <Text key={i} style={styles.errorText}>{err}</Text>)}
                </>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#11191d',
    borderBottomWidth: 1,
    borderBottomColor: '#263239',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 10, marginTop: 3, maxWidth: 240 },
  actions: { flexDirection: 'row', gap: 8 },
  button: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 7 },
  clearButton: { backgroundColor: '#7f1d1d' },
  closeButton: { backgroundColor: '#334155' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logContainer: { flex: 1 },
  logContent: { padding: 12, paddingBottom: 28 },
  linkPanel: {
    backgroundColor: '#11191d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263239',
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 },
  healthLine: { color: '#94a3b8', fontSize: 12, lineHeight: 20 },
  healthValue: { color: '#f8fafc', fontWeight: '800' },
  summaryPanel: {
    backgroundColor: '#11191d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263239',
    padding: 12,
    marginBottom: 10,
  },
  summaryRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#1f2a30' },
  summaryCommand: { color: '#e2e8f0', fontSize: 12, fontWeight: '800' },
  summaryText: { color: '#94a3b8', fontSize: 10, marginTop: 2, fontFamily: 'monospace' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 36 },
  logEntry: {
    backgroundColor: '#11191d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#263239',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#263239',
    paddingBottom: 8,
  },
  logHeaderCopy: { flex: 1 },
  commandText: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  timestampText: { color: '#64748b', fontSize: 9, marginTop: 2 },
  detailLabel: { color: '#64748b', fontSize: 10, marginTop: 6, marginBottom: 2, fontWeight: '700' },
  detailText: { color: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' },
  errorText: { color: '#fca5a5', fontSize: 11, fontFamily: 'monospace' },
});
