import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, ScrollView, StyleSheet, Alert, AppState } from 'react-native';
import { MatrixOrchestrator, MatrixOrchestratorState } from '../../infrastructure/database/benchmark/MatrixOrchestrator';
import { runNativeCorrectness } from '../../infrastructure/database/benchmark/native_correctness';
import * as FileSystem from 'expo-file-system';

export const BenchmarkDevScreen = () => {
  const [orchestrator, setOrchestrator] = useState<MatrixOrchestrator | null>(null);
  const [matrixState, setMatrixState] = useState<MatrixOrchestratorState | null>(null);
  const orchestratorRef = useRef<MatrixOrchestrator | null>(null);

  useEffect(() => {
    // Load state on mount
    MatrixOrchestrator.load().then(orch => {
      if (orch) {
        setOrchestrator(orch);
        orchestratorRef.current = orch;
        setMatrixState(orch.getState());
        orch.onProgress = setMatrixState;
      }
    });

    // Handle backgrounding
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (orchestratorRef.current) {
          orchestratorRef.current.interrupt();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!__DEV__) {
    return (
      <View style={styles.center}>
        <Text>Benchmark tools are disabled in this build.</Text>
      </View>
    );
  }

  const startMatrix = async (profile: 'BASELINE' | 'HIGH_VOLUME') => {
    try {
      const orch = await MatrixOrchestrator.create(profile);
      setOrchestrator(orch);
      orchestratorRef.current = orch;
      setMatrixState(orch.getState());
      orch.onProgress = setMatrixState;
      await orch.startOrResume();
    } catch (e: any) {
      Alert.alert('Matrix Error', e.message);
    }
  };

  const handleResume = async () => {
    if (orchestrator) {
      await orchestrator.startOrResume();
    }
  };

  const handleCancel = async () => {
    if (orchestrator) {
      await orchestrator.cancel();
      setOrchestrator(null);
      setMatrixState(null);
    }
  };

  const handleInterrupt = async () => {
    if (orchestrator) {
      await orchestrator.interrupt();
    }
  };

  const handleExport = async () => {
    if (orchestrator) {
      const uri = await orchestrator.exportResults();
      Alert.alert('Exported', `Partial results exported to:\n${uri}`);
    }
  };

  const renderMonitor = () => {
    if (!matrixState) return null;

    const currentRun = matrixState.runs[matrixState.currentRunIndex];
    const progress = Math.round((matrixState.currentRunIndex / matrixState.runs.length) * 100);
    const lastResult = matrixState.lastResult;

    return (
      <View style={styles.monitorCard}>
        <Text style={styles.monitorTitle}>MATRIX MONITOR: {matrixState.profile}</Text>
        <Text style={styles.monitorText}>Status: {matrixState.status}</Text>
        <Text style={styles.monitorText}>Progress: {progress}% ({matrixState.currentRunIndex} / {matrixState.runs.length} runs)</Text>

        {lastResult && (
          <>
            <Text style={styles.monitorText}>Requests: {lastResult.requestsSent}</Text>
            <Text style={styles.monitorText}>Responses: {lastResult.responsesReceived}</Text>
            <Text style={styles.monitorText}>Timeouts: {lastResult.timeouts}</Text>
            <Text style={styles.monitorText}>Unsupported: {lastResult.unsupportedPidCount}</Text>
            <Text style={styles.monitorText}>Adapter Latency P99: {lastResult.p99AdapterRoundTripMs} ms</Text>
          </>
        )}

        {currentRun && matrixState.status === 'RUNNING' && (
          <View style={styles.runDetails}>
            <Text style={styles.monitorText}>Current Format: {currentRun.formatId}</Text>
            <Text style={styles.monitorText}>Type: {currentRun.isWarmup ? 'WARMUP (15s)' : 'MEASURED (60s)'}</Text>
          </View>
        )}

        <View style={styles.buttonGroup}>
          {matrixState.status === 'INTERRUPTED' && <Button title="Resume Matrix" onPress={handleResume} color="green" />}
          {matrixState.status === 'RUNNING' && <Button title="Interrupt (Pause)" onPress={handleInterrupt} color="orange" />}
          <Button title="Abort & Cancel" onPress={handleCancel} color="red" />
          <Button title="Export Partial Results" onPress={handleExport} color="#5bc0de" />
        </View>
      </View>
    );
  };

  const isRunning = matrixState !== null && matrixState.status !== 'COMPLETED' && matrixState.status !== 'CANCELLED';

  const handleRunNativeCorrectness = async () => {
    if (isRunning) return;
    try {
      const testResults = await runNativeCorrectness();
      const fileUri = FileSystem.documentDirectory + `c0_n1_correctness_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(testResults, null, 2));

      const failures = testResults.filter(r => r.state !== 'PASS').map(r => r.format);
      if (failures.length > 0) {
        Alert.alert('C0-N1 Finished with errors', `Failed formats: ${failures.join(', ')}\nExported to:\n${fileUri}`);
      } else {
        Alert.alert('C0-N1 PASS', `All formats passed correctness natively!\nExported to:\n${fileUri}`);
      }
    } catch (e: any) {
      Alert.alert('C0-N1 Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>APC-03.C0-N2 Benchmark Lab</Text>

      {renderMonitor()}

      <View style={[styles.card, isRunning && styles.disabledCard]}>
        <Text style={styles.cardTitle}>Baseline Matrix</Text>
        <Text style={styles.cardText}>Requested PIDs: 12</Text>
        <Text style={styles.cardText}>Polling: Prioritized</Text>
        <Text style={styles.cardText}>Protocol: CAN 11bit 500k</Text>
        <Text style={styles.cardText}>Chunk: 5 seconds</Text>
        <Text style={styles.cardText}>Codec: NONE</Text>
        <Text style={styles.cardText}>• 3 Warmups + 9 Measured (12 Runs)</Text>
        <Button
          title="Run C0-N2 Baseline — 12 Runs"
          onPress={() => startMatrix('BASELINE')}
          disabled={isRunning}
          color="#3498db"
        />
      </View>

      <View style={[styles.card, isRunning && styles.disabledCard]}>
        <Text style={styles.cardTitle}>High Volume Matrix</Text>
        <Text style={styles.cardText}>Requested PIDs: 24</Text>
        <Text style={styles.cardText}>Polling: Prioritized</Text>
        <Text style={styles.cardText}>Protocol: CAN 11bit 500k</Text>
        <Text style={styles.cardText}>Chunk: 5 seconds</Text>
        <Text style={styles.cardText}>Codec: NONE</Text>
        <Text style={styles.cardText}>• 3 Warmups + 9 Measured (12 Runs)</Text>
        <Button
          title="Run C0-N2 High Volume — 12 Runs"
          onPress={() => startMatrix('HIGH_VOLUME')}
          disabled={isRunning}
          color="#9b59b6"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Utilities</Text>
        <Button title="C0-N1: Run Native Correctness" onPress={handleRunNativeCorrectness} color="#8e44ad" disabled={isRunning} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  card: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  disabledCard: { opacity: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  cardText: { fontSize: 14, color: '#444', marginBottom: 4 },
  monitorCard: { backgroundColor: '#fff3cd', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#ffeeba' },
  monitorTitle: { fontSize: 16, fontWeight: 'bold', color: '#856404', marginBottom: 8 },
  monitorText: { fontSize: 14, color: '#856404', marginBottom: 4 },
  runDetails: { marginTop: 8, padding: 8, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 4 },
  buttonGroup: { flexDirection: 'column', gap: 8, marginTop: 12 },
});
