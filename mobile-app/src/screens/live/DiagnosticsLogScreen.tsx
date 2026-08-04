import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, TextStyle } from 'react-native';
import { DiagnosticsBuffer } from '../../infrastructure/ble/real/DiagnosticsBuffer';
import { CommandResult } from '../../infrastructure/ble/real/pipeline/types';

interface DiagnosticsLogScreenProps {
  onClose: () => void;
}

const getStatusStyle = (status: string): TextStyle => ({
  color: status.includes('SUCCESS') ? '#4cd137' : (status === 'NO_DATA' || status === 'TIMEOUT' ? '#fbc531' : '#e84118'),
  fontWeight: 'bold',
});

export const DiagnosticsLogScreen: React.FC<DiagnosticsLogScreenProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<CommandResult[]>([]);

  useEffect(() => {
    // Basic polling to keep logs updated in this dev view
    const interval = setInterval(() => {
      setLogs(DiagnosticsBuffer.getHistory());
    }, 1000);
    setLogs(DiagnosticsBuffer.getHistory());

    return () => clearInterval(interval);
  }, []);

  const handleClear = () => {
    DiagnosticsBuffer.clear();
    setLogs([]);
  };

  const handleCopyAll = async () => {
    // Clipboard not installed by default in this project, just showing alert for now
    Alert.alert('Info', 'Copy feature requires expo-clipboard to be installed.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OBD Diagnostics Log</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleCopyAll} style={styles.button}>
            <Text style={styles.buttonText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={[styles.button, styles.clearButton]}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.button, styles.closeButton]}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No diagnostic logs yet.</Text>
        ) : (
          [...logs].reverse().map((log, index) => (
            <View key={log.request.id || index} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <Text style={styles.commandText}>{log.request.command} ({log.request.family})</Text>
                <Text style={getStatusStyle(log.status)}>{log.status}</Text>
              </View>

              <Text style={styles.detailLabel}>Latency:</Text>
              <Text style={styles.detailText}>{log.latencyMs} ms</Text>

              <Text style={styles.detailLabel}>Raw Input:</Text>
              <Text style={styles.detailText}>{log.rawResponse?.accumulatedText.replace(/\r/g, '\\r').replace(/\n/g, '\\n') || 'N/A'}</Text>

              {log.normalizedResponse && (
                <>
                  <Text style={styles.detailLabel}>Normalized:</Text>
                  <Text style={styles.detailText}>{log.normalizedResponse.normalizedText || '(empty)'}</Text>
                </>
              )}

              {log.classifiedLines.length > 0 && (
                <>
                  <Text style={styles.detailLabel}>Classifications:</Text>
                  {log.classifiedLines.map((line, i) => (
                    <Text key={i} style={styles.detailText}>
                      - {line.classification}: {line.originalText.trim() || '\\r'}
                    </Text>
                  ))}
                </>
              )}

              {log.obdFrames.length > 0 && (
                <>
                  <Text style={styles.detailLabel}>OBD Frames:</Text>
                  {log.obdFrames.map((frame, i) => (
                    <Text key={i} style={styles.detailText}>
                      - [{frame.validity}] ECU:{frame.sourceAddress} SVC:{frame.service} PID:{frame.pid} Data:[{frame.payloadBytes.map(b => b.toString(16).padStart(2, '0')).join(',')}]
                    </Text>
                  ))}
                </>
              )}

              {log.decodedValues.length > 0 && (
                <>
                  <Text style={styles.detailLabel}>Decoded Values:</Text>
                  {log.decodedValues.map((val, i) => (
                    <Text key={i} style={styles.detailText}>
                      - {val.type}: {JSON.stringify(val.value)} {val.unit}
                    </Text>
                  ))}
                </>
              )}

              {log.errors.length > 0 && (
                <>
                  <Text style={styles.detailLabel}>Errors:</Text>
                  {log.errors.map((err, i) => (
                    <Text key={i} style={styles.errorText}>- {err}</Text>
                  ))}
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButton: {
    backgroundColor: '#e94560',
  },
  closeButton: {
    backgroundColor: '#535c68',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    padding: 12,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  logEntry: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    paddingBottom: 8,
  },
  commandText: {
    color: '#4cd137',
    fontWeight: 'bold',
    fontSize: 16,
  },
  detailLabel: {
    color: '#a4b0be',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 2,
  },
  detailText: {
    color: '#dfe4ea',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#e84118',
    fontSize: 13,
    fontFamily: 'monospace',
  }
});
