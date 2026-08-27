import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AutoPulseCheckEngine } from '../../application/check/AutoPulseCheckEngine';
import { CheckDiagnosticCaptureKind } from '../../application/check/CheckDiagnosticCapture';
import { activeBleController, ActiveConnection } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { RealObdInitialization } from '../../infrastructure/ble/real/RealObdInitialization';
import { productCheckIdFactory } from '../../infrastructure/check/ProductCheckIdFactory';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { ElmBleDiagnosticConnector } from '../../infrastructure/diagnostics/ElmBleDiagnosticConnector';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { createEvaluationId } from '../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../domain/shared/timestamps';

const CAPTURE_STEPS: Array<{
  key: 'CAPABILITY' | CheckDiagnosticCaptureKind;
  label: string;
}> = [
  { key: 'CAPABILITY', label: 'Vehicle capability discovery' },
  { key: 'STORED_DTC', label: 'Stored diagnostic trouble codes' },
  { key: 'READINESS', label: 'OBD monitor status' },
  { key: 'FREEZE_FRAME_TRIGGER', label: 'Freeze-frame trigger evidence' },
];

type CaptureStepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
type CapturePhase = 'WAITING' | 'RUNNING' | 'DONE' | 'FAILED';

interface CaptureStepState {
  readonly key: string;
  readonly label: string;
  readonly status: CaptureStepStatus;
  readonly detail?: string;
}

function initialSteps(): CaptureStepState[] {
  return CAPTURE_STEPS.map(step => ({ ...step, status: 'PENDING' }));
}

function diagnosticDetail(kind: CheckDiagnosticCaptureKind, metadata?: Record<string, any>): string {
  const status = metadata?.executionStatus ?? 'UNKNOWN';
  if (kind === 'STORED_DTC') {
    const codes = Array.isArray(metadata?.diagnosticCodes) ? metadata.diagnosticCodes : [];
    return status === 'SUCCESS'
      ? `${codes.length} stored code${codes.length === 1 ? '' : 's'} observed`
      : `Service response: ${status}`;
  }
  if (kind === 'READINESS') {
    const monitor = metadata?.monitorStatus;
    if (status === 'SUCCESS' && monitor) {
      return `MIL ${monitor.milOn ? 'ON' : 'OFF'} · confirmed DTC count ${monitor.confirmedDtcCount}`;
    }
    return `Monitor response: ${status}`;
  }
  const trigger = metadata?.freezeFrameTrigger;
  if (status === 'SUCCESS' && trigger) {
    return `Frame ${trigger.frameNumber}${trigger.triggerDtc ? ` · trigger ${trigger.triggerDtc}` : ''}`;
  }
  return status === 'NO_DATA'
    ? 'No freeze-frame trigger was available in this capture.'
    : `Freeze-frame response: ${status}`;
}

export default function CheckDiagnosticCaptureScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const evaluationId = route.params?.evaluationId as string | undefined;
  const vehicleId = route.params?.vehicleId as string | undefined;
  const connectionHandleId = route.params?.connectionHandleId as string | undefined;
  const adapterInstanceId = route.params?.adapterInstanceId as string | undefined;

  const [phase, setPhase] = useState<CapturePhase>('WAITING');
  const [steps, setSteps] = useState<CaptureStepState[]>(initialSteps);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);
  const controllerRef = useRef<RealObdController | null>(null);
  const connectionRef = useRef<ActiveConnection | null>(null);

  const updateStep = useCallback((key: string, patch: Partial<CaptureStepState>) => {
    setSteps(current => current.map(step => step.key === key ? { ...step, ...patch } : step));
  }, []);

  const releaseConnection = useCallback(async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    controllerRef.current?.disconnect();
    const connection = connectionRef.current
      ?? (connectionHandleId ? activeBleController.getConnection(connectionHandleId) : null);
    activeBleController.releaseConnection();
    if (connection?.device) {
      try {
        await connection.device.cancelConnection();
      } catch (disconnectError) {
        console.warn('[AutoPulseCheck] BLE disconnect after capture was not clean:', disconnectError);
      }
    }
  }, [connectionHandleId]);

  const runCapture = useCallback(async () => {
    if (!db || !evaluationId || !connectionHandleId || startedRef.current) return;
    startedRef.current = true;
    setPhase('RUNNING');
    setError(null);

    const connection = activeBleController.getConnection(connectionHandleId);
    if (!connection) {
      setPhase('FAILED');
      setError('The retained diagnostic connection is no longer available. Reconnect the adapter and try again.');
      return;
    }
    connectionRef.current = connection;

    const controller = new RealObdController(connection);
    controllerRef.current = controller;
    const store = new CheckEvaluationRepository(db);
    const engine = new AutoPulseCheckEngine(
      store,
      productCheckIdFactory,
      () => parseUtcIsoTimestamp(new Date().toISOString()),
    );

    try {
      updateStep('CAPABILITY', { status: 'RUNNING', detail: 'Initializing adapter and discovering ECU support…' });
      const initialization = new RealObdInitialization(controller, step => {
        updateStep('CAPABILITY', {
          status: 'RUNNING',
          detail: `Discovery stage ${Math.min(step + 1, 6)} of 6`,
        });
      });
      const snapshot = await initialization.execute();
      const capabilityEvidence = await engine.recordCapabilityDiscovery({
        evaluationId: createEvaluationId(evaluationId),
        initializationSuccessful: snapshot.initializationSuccessful,
        protocol: snapshot.protocol,
        supportedPids: snapshot.supportedPids,
        directlyObservedPids: snapshot.directlyObservedPids,
        adapterIdentity: snapshot.adapterIdentity,
        failureReason: snapshot.failureReason,
      });
      if (capabilityEvidence.ok === false) throw new Error(capabilityEvidence.error.message);

      if (!snapshot.initializationSuccessful) {
        updateStep('CAPABILITY', {
          status: 'FAILED',
          detail: snapshot.failureReason ?? 'No valid standard OBD signal was established.',
        });
        setPhase('FAILED');
        setError('AutoPulse could not prove a vehicle ECU diagnostic channel. The failed discovery was retained as evidence.');
        await releaseConnection();
        return;
      }

      updateStep('CAPABILITY', {
        status: 'DONE',
        detail: `${snapshot.supportedPids.length} supported PID${snapshot.supportedPids.length === 1 ? '' : 's'} · protocol ${snapshot.protocol ?? 'unresolved'}`,
      });

      const connector = new ElmBleDiagnosticConnector(controller, {
        identity: {
          hardwareId: adapterInstanceId,
        },
      });

      for (const kind of ['STORED_DTC', 'READINESS', 'FREEZE_FRAME_TRIGGER'] as CheckDiagnosticCaptureKind[]) {
        updateStep(kind, { status: 'RUNNING', detail: 'Reading vehicle evidence…' });
        const result = await engine.captureDiagnosticEvidence({
          evaluationId: createEvaluationId(evaluationId),
          connector,
          kind,
        });

        if (result.ok === false) {
          updateStep(kind, { status: 'FAILED', detail: result.error.message });
          continue;
        }

        updateStep(kind, {
          status: result.value.state === 'FAILED' ? 'FAILED' : 'DONE',
          detail: diagnosticDetail(kind, result.value.metadata),
        });
      }

      await releaseConnection();
      setPhase('DONE');
    } catch (captureError) {
      console.error('[AutoPulseCheck] Diagnostic evidence capture failed:', captureError);
      setPhase('FAILED');
      setError(captureError instanceof Error ? captureError.message : 'Diagnostic evidence capture failed.');
      await releaseConnection();
    }
  }, [adapterInstanceId, connectionHandleId, db, evaluationId, releaseConnection, updateStep]);

  useEffect(() => {
    void runCapture();
  }, [runCapture]);

  useEffect(() => () => {
    void releaseConnection();
  }, [releaseConnection]);

  const completed = steps.filter(step => step.status === 'DONE').length;
  const failed = steps.filter(step => step.status === 'FAILED').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>AUTOPULSE CHECK · READ ONLY</Text>
        <Text style={styles.title}>Diagnostic capture</Text>
        <Text style={styles.subtitle}>{vehicleId ? `Vehicle ${vehicleId.slice(0, 8)}…` : 'Vehicle'} · evidence is committed step by step</Text>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Vehicle write boundary active</Text>
          <Text style={styles.safetyText}>Only adapter configuration and read-only OBD requests are executed. No DTC clear, reset, actuator, coding or programming command is part of this workflow.</Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{phase === 'DONE' ? 'Capture complete' : phase === 'FAILED' ? 'Capture stopped' : 'Collecting evidence'}</Text>
            {phase === 'RUNNING' || phase === 'WAITING' ? <ActivityIndicator color="#d9ff3f" /> : null}
          </View>
          <Text style={styles.progressMeta}>{completed} completed · {failed} failed · {steps.length} total</Text>
        </View>

        {steps.map((step, index) => (
          <View key={step.key} style={styles.stepRow}>
            <View style={[
              styles.stepMarker,
              step.status === 'DONE' && styles.stepMarkerDone,
              step.status === 'FAILED' && styles.stepMarkerFailed,
              step.status === 'RUNNING' && styles.stepMarkerRunning,
            ]}>
              <Text style={styles.stepMarkerText}>{step.status === 'DONE' ? '✓' : step.status === 'FAILED' ? '!' : String(index + 1)}</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.label}</Text>
              <Text style={styles.stepDetail}>{step.detail ?? (step.status === 'PENDING' ? 'Waiting' : step.status)}</Text>
            </View>
            <Text style={[
              styles.stepStatus,
              step.status === 'DONE' && styles.goodText,
              step.status === 'FAILED' && styles.badText,
              step.status === 'RUNNING' && styles.runningText,
            ]}>{step.status}</Text>
          </View>
        ))}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Capture limitation recorded</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {phase === 'DONE' || phase === 'FAILED' ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Return to evaluation</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  content: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 36 },
  eyebrow: { color: '#84cc16', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 5 },
  safetyCard: { borderRadius: 15, borderWidth: 1, borderColor: '#365314', backgroundColor: '#141b11', padding: 14, marginTop: 20 },
  safetyTitle: { color: '#bef264', fontSize: 12, fontWeight: '900' },
  safetyText: { color: '#9baa8d', fontSize: 11, lineHeight: 17, marginTop: 5 },
  progressCard: { borderRadius: 16, borderWidth: 1, borderColor: '#26343d', backgroundColor: '#11191e', padding: 15, marginTop: 18 },
  progressHeader: { flexDirection: 'row', alignItems: 'center' },
  progressTitle: { flex: 1, color: '#f8fafc', fontSize: 14, fontWeight: '800' },
  progressMeta: { color: '#64748b', fontSize: 10, marginTop: 6 },
  stepRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1f2a30', paddingVertical: 12 },
  stepMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#172027', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  stepMarkerDone: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: '#166534' },
  stepMarkerFailed: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#7f1d1d' },
  stepMarkerRunning: { backgroundColor: 'rgba(217,255,63,0.12)', borderWidth: 1, borderColor: '#647a1b' },
  stepMarkerText: { color: '#cbd5e1', fontSize: 12, fontWeight: '900' },
  stepCopy: { flex: 1, paddingRight: 8 },
  stepTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  stepDetail: { color: '#718096', fontSize: 10, lineHeight: 15, marginTop: 4 },
  stepStatus: { color: '#64748b', fontSize: 8, fontWeight: '900' },
  goodText: { color: '#4ade80' },
  badText: { color: '#f87171' },
  runningText: { color: '#d9ff3f' },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: '#1f1113', padding: 14, marginTop: 18 },
  errorTitle: { color: '#fca5a5', fontSize: 12, fontWeight: '900' },
  errorText: { color: '#c98b91', fontSize: 11, lineHeight: 17, marginTop: 5 },
  primaryButton: { minHeight: 58, borderRadius: 16, backgroundColor: '#d9ff3f', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryButtonText: { color: '#172000', fontSize: 15, fontWeight: '900' },
});
