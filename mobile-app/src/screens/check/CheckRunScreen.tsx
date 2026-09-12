import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import {
  runCheckPhysicalPilotV4,
  type CheckPhysicalPilotStageV4,
  type CheckPhysicalPilotV4Result,
} from '../../application/check/live/CheckPhysicalPilotV4';
import { CheckPilotCancellationToken } from '../../application/check/live/RealCheckPlannedExecutor';
import {
  presentCapabilityAssessment,
  presentCheckScanState,
  presentDtcResult,
  technicalDtcOutcome,
} from '../../application/check/live/CheckPilotPresentation';
import { formatDecodedPidObservation } from '../../application/check/intelligence/Mode01ValueDecoder';
import type { DiagnosticConcernV2 } from '../../application/check/intelligence/DiagnosticConcernEngine';

type UiState = 'IDLE' | 'RUNNING' | 'CANCELLING' | 'COMPLETE' | 'ERROR' | 'CANCELLED';

const stageLabel: Record<CheckPhysicalPilotStageV4, string> = {
  PREPARING_ADAPTER: 'Preparing read-only adapter channel',
  NEGOTIATING_PROTOCOL: 'Discovering vehicle protocol',
  RUNNING_STANDARD_SCAN: 'Reading standard ECU diagnostic evidence',
  RUNNING_DIRECT_PID_CORROBORATION: 'Corroborating exact Mode 01 observations',
  SEALING_PILOT_RESULT: 'Sealing core diagnostic evidence',
  PLANNING_TARGETED_EVIDENCE: 'Selecting relevant ECU evidence',
  RUNNING_TARGETED_EVIDENCE: 'Reading targeted diagnostic evidence',
  CORRELATING_DIAGNOSTIC_EVIDENCE: 'Correlating ECU evidence',
};

function toneStyle(tone: 'POSITIVE' | 'ATTENTION' | 'NEUTRAL') {
  if (tone === 'POSITIVE') return styles.positive;
  if (tone === 'ATTENTION') return styles.attention;
  return styles.neutral;
}

function statusLabel(statuses: DiagnosticConcernV2['statuses']): string {
  return statuses.join(' + ');
}

function ConcernCard({ concern }: { concern: DiagnosticConcernV2 }) {
  return (
    <View style={styles.concernCard}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.concernTitle}>{concern.title}</Text>
          <Text style={styles.codeText}>{concern.code} · {statusLabel(concern.statuses)}</Text>
        </View>
        <Text style={styles.warningMark}>!</Text>
      </View>
      <Text style={styles.confirmed}>ECU event confirmed</Text>
      {concern.relatedEvidence.length > 0 ? (
        <View style={styles.evidenceInset}>
          <Text style={styles.smallHeading}>Related evidence</Text>
          {concern.relatedEvidence.slice(0, 5).map(item => (
            <Text key={`${concern.code}-${item.requestId}`} style={styles.compactLine}>{formatDecodedPidObservation(item)}</Text>
          ))}
        </View>
      ) : <Text style={styles.muted}>No additional targeted PID evidence was established for this concern.</Text>}
      <Text style={styles.smallHeading}>Possible systems</Text>
      <Text style={styles.body}>{concern.possibleSystemGroups.join(' · ')}</Text>
      <Text style={styles.causeLimit}>Exact cause not established</Text>
      {concern.limitations.map(item => <Text key={item} style={styles.muted}>• {item}</Text>)}
    </View>
  );
}

export default function CheckRunScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const vehicleId = route.params?.vehicleId as string | undefined;
  const connectionHandleId = route.params?.connectionHandleId as string | undefined;
  const { vehicle } = useVehicle(vehicleId);
  const [uiState, setUiState] = useState<UiState>('IDLE');
  const [stage, setStage] = useState<CheckPhysicalPilotStageV4 | null>(null);
  const [result, setResult] = useState<CheckPhysicalPilotV4Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const cancellationRef = useRef(new CheckPilotCancellationToken());
  const controllerRef = useRef<RealObdController | null>(null);
  const connection = connectionHandleId ? activeBleController.getConnection(connectionHandleId) : null;

  useEffect(() => () => {
    cancellationRef.current.cancel();
    controllerRef.current?.disconnect();
    if (connection) {
      void connection.device.cancelConnection().catch(() => undefined);
      activeBleController.releaseConnection();
    }
  }, [connection]);

  const run = async () => {
    if (!connection || !connectionHandleId) {
      setError('The retained OBD connection is no longer available. Reconnect the adapter.');
      setUiState('ERROR');
      return;
    }
    setError(null);
    setResult(null);
    setShowTechnical(false);
    setStage('PREPARING_ADAPTER');
    setUiState('RUNNING');
    cancellationRef.current = new CheckPilotCancellationToken();
    const controller = new RealObdController(connection);
    controllerRef.current = controller;
    try {
      const pilotResult = await runCheckPhysicalPilotV4({
        controller,
        connectionHandleId,
        cancellation: cancellationRef.current,
        onStage: setStage,
      });
      setResult(pilotResult);
      setUiState(cancellationRef.current.isCancelled ? 'CANCELLED' : 'COMPLETE');
    } catch (reason) {
      if (cancellationRef.current.isCancelled) {
        setUiState('CANCELLED');
        setError(null);
      } else {
        setError(reason instanceof Error ? reason.message : 'Check stopped safely.');
        setUiState('ERROR');
      }
    }
  };

  const cancel = () => {
    cancellationRef.current.cancel();
    setUiState('CANCELLING');
  };

  const scanPresentation = result ? presentCheckScanState(result.scan.state) : null;
  const capabilityPresentation = result ? presentCapabilityAssessment(result.capabilityAssessment) : null;
  const issueCount = result?.concerns.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>← Check</Text>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>ECU CHECK · V4</Text>
            <Text style={styles.title}>{vehicle?.alias ?? 'Vehicle'} Check</Text>
          </View>
          <Text style={styles.readOnlyBadge}>READ ONLY</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {uiState === 'IDLE' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Ready</Text>
            <Text style={styles.body}>AutoPulse will read standard ECU diagnostics, readiness and only the PID evidence selected for this vehicle and its reported concerns.</Text>
            <Text style={styles.safetyText}>Parked vehicle only. Clear, reset, control, coding and write operations remain blocked.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => void run()} testID="run-physical-check">
              <Text style={styles.primaryText}>Run Check</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(uiState === 'RUNNING' || uiState === 'CANCELLING') ? (
          <View style={styles.panel}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.panelTitle}>{uiState === 'CANCELLING' ? 'Cancelling safely…' : stage ? stageLabel[stage] : 'Running Check…'}</Text>
            <Text style={styles.body}>Serial · bounded · descriptor-gated · no blind PID sweep</Text>
            {uiState === 'RUNNING' ? <TouchableOpacity style={styles.secondary} onPress={cancel}><Text style={styles.secondaryText}>Cancel Check</Text></TouchableOpacity> : null}
          </View>
        ) : null}

        {uiState === 'CANCELLED' ? <View style={styles.panel}><Text style={styles.panelTitle}>Check cancelled</Text><Text style={styles.body}>No additional request will be issued.</Text></View> : null}

        {uiState === 'ERROR' ? (
          <View style={styles.panel}>
            <Text style={styles.errorTitle}>Check stopped safely</Text>
            <Text style={styles.body}>{error}</Text>
            <TouchableOpacity style={styles.secondary} onPress={() => void run()}><Text style={styles.secondaryText}>Retry Check</Text></TouchableOpacity>
          </View>
        ) : null}

        {result && uiState === 'COMPLETE' && scanPresentation && capabilityPresentation ? (
          <>
            <View style={issueCount > 0 ? styles.summaryAttention : styles.summaryGood}>
              <Text style={styles.summaryKicker}>{issueCount > 0 ? `${issueCount} diagnostic issue${issueCount === 1 ? '' : 's'} reported` : 'No diagnostic codes reported'}</Text>
              <Text style={styles.body}>{issueCount > 0 ? 'ECU-recorded conditions are shown below with targeted evidence. Root cause is not assumed.' : 'The successfully scanned standard DTC services did not report a code.'}</Text>
              <Text style={styles.scopeNote}>{scanPresentation.label} · {result.protocol}</Text>
            </View>

            {result.concerns.map(concern => <ConcernCard key={concern.concernId} concern={concern} />)}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Current ECU evidence</Text>
              {result.decodedPidEvidence.length > 0 ? result.decodedPidEvidence.map(item => (
                <View key={`${item.requestId}-${item.sourceEndpointId ?? 'u'}`} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{item.name}</Text>
                  <Text style={styles.metricValue}>{formatDecodedPidObservation(item).replace(`${item.signals[0]?.label}: `, '')}</Text>
                </View>
              )) : <Text style={styles.muted}>No promoted current-data value was established.</Text>}
              <Text style={styles.walletNote}>{result.targetedEvidencePlan.requests.length} targeted PID request{result.targetedEvidencePlan.requests.length === 1 ? '' : 's'} selected from the larger reference wallet. No blind sweep.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Emissions readiness</Text>
              {result.readiness ? (
                <>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>MIL</Text><Text style={result.readiness.milOn ? styles.attention : styles.positive}>{result.readiness.milOn ? 'ON' : 'OFF'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>Confirmed DTC count</Text><Text style={styles.metricValue}>{result.readiness.confirmedDtcCount}</Text></View>
                  {result.readiness.monitors.map(monitor => (
                    <View key={monitor.id} style={styles.metricRow}><Text style={styles.metricLabel}>{monitor.label}</Text><Text style={monitor.state === 'READY' ? styles.positive : monitor.state === 'NOT_READY' ? styles.attention : styles.neutral}>{monitor.state.replace('_', ' ')}</Text></View>
                  ))}
                </>
              ) : <Text style={styles.muted}>Readiness was not established from a validated PID 0101 response.</Text>}
              <Text style={styles.scopeNote}>NOT READY means the monitor has not completed; it does not mean the monitor failed.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Standard OBD coverage</Text>
              <View style={styles.metricRow}><Text style={styles.metricLabel}>PID capability</Text><Text style={toneStyle(capabilityPresentation.tone)}>{capabilityPresentation.label}</Text></View>
              <Text style={styles.muted}>{capabilityPresentation.detail}</Text>
              {result.scan.dtcResults.map((dtc, index) => {
                const presented = presentDtcResult(dtc);
                return (
                  <View key={`${dtc.status}-${index}`} style={styles.serviceRow}>
                    <Text style={styles.metricLabel}>{dtc.status === 'STORED' ? 'Stored DTCs' : dtc.status === 'PENDING' ? 'Pending DTCs' : 'Permanent DTCs'}</Text>
                    <Text style={toneStyle(presented.tone)}>{presented.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Scope</Text>
              <Text style={styles.muted}>Standard OBD evidence only. Unsupported modules are not called healthy. Mode 06 and Freeze Frame remain gated rather than guessed.</Text>
            </View>

            <TouchableOpacity style={styles.technicalToggle} onPress={() => setShowTechnical(value => !value)} testID="toggle-check-technical-details">
              <Text style={styles.technicalToggleText}>{showTechnical ? 'Hide technical evidence' : 'Show technical evidence'}</Text>
            </TouchableOpacity>

            {showTechnical ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Technical evidence</Text>
                <Text style={styles.meta}>Pilot: {result.pilotVersion}</Text>
                <Text style={styles.meta}>Protocol evidence: {result.protocolEvidence || 'not retained'}</Text>
                <Text style={styles.meta}>Core commands: {result.scanCommandCount}</Text>
                <Text style={styles.meta}>v3 corroboration commands: {result.directObservationCommandCount}</Text>
                <Text style={styles.meta}>v4 targeted commands: {result.targetedEvidenceScan?.usage.commandsIssued ?? 0}</Text>
                <Text style={styles.meta}>Planner: {result.targetedEvidencePlan.version}</Text>
                <Text style={styles.meta}>Selected: {result.targetedEvidencePlan.requests.map(item => `01${item.pid}`).join(' · ') || 'none'}</Text>
                {result.rawEvidence.map((evidence, index) => (
                  <View key={`${evidence.phase}-${evidence.semanticId}-${index}`} style={styles.rawBlock}>
                    <Text style={styles.rawHeading}>{evidence.phase} · {evidence.service}{evidence.pid ?? ''} · {evidence.responseKind}</Text>
                    <Text style={styles.rawMeta}>ECU {evidence.sourceEndpointId ?? 'UNATTRIBUTED'} · {evidence.observedResponseBytes} bytes</Text>
                    <Text selectable style={styles.rawText}>{evidence.rawText ?? 'No raw diagnostic text retained'}</Text>
                  </View>
                ))}
                {result.scan.dtcResults.map((dtc, index) => <Text key={`dtc-tech-${index}`} style={styles.meta}>{dtc.status}: {technicalDtcOutcome(dtc)} · ECU {dtc.sourceEndpointId ?? 'UNATTRIBUTED'}</Text>)}
                {result.technicalLimitations.length > 0 ? <Text style={styles.meta}>Engine limitations: {result.technicalLimitations.join(' · ')}</Text> : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1 },
  back: { color: '#60a5fa', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  eyebrow: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#f8fafc', fontSize: 25, fontWeight: '900', marginTop: 4 },
  readOnlyBadge: { color: '#86efac', borderWidth: 1, borderColor: '#166534', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 72 },
  panel: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 15, marginBottom: 12 },
  panelTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 18 },
  body: { color: '#cbd5e1', lineHeight: 20, marginTop: 7 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 7 },
  safetyText: { color: '#fbbf24', fontSize: 12, lineHeight: 18, marginTop: 12 },
  primary: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#475569', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  secondaryText: { color: '#e2e8f0', fontWeight: '800' },
  errorTitle: { color: '#fca5a5', fontWeight: '900', fontSize: 20 },
  summaryAttention: { backgroundColor: '#2a1c08', borderWidth: 1, borderColor: '#a16207', borderRadius: 16, padding: 17, marginBottom: 12 },
  summaryGood: { backgroundColor: '#0c2a1a', borderWidth: 1, borderColor: '#166534', borderRadius: 16, padding: 17, marginBottom: 12 },
  summaryKicker: { color: '#f8fafc', fontSize: 22, fontWeight: '900' },
  scopeNote: { color: '#64748b', fontSize: 10, lineHeight: 15, marginTop: 10 },
  concernCard: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#854d0e', borderRadius: 16, padding: 15, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  concernTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '900' },
  codeText: { color: '#fbbf24', fontSize: 12, fontWeight: '800', marginTop: 4 },
  warningMark: { color: '#fbbf24', fontSize: 22, fontWeight: '900' },
  confirmed: { color: '#4ade80', fontSize: 12, fontWeight: '900', marginTop: 10 },
  evidenceInset: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#263139', paddingTop: 8 },
  smallHeading: { color: '#94a3b8', fontSize: 11, fontWeight: '900', marginTop: 9 },
  compactLine: { color: '#cbd5e1', fontSize: 11, lineHeight: 17, marginTop: 4 },
  causeLimit: { color: '#fbbf24', fontSize: 11, fontWeight: '800', marginTop: 10 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#202a30', paddingVertical: 9 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 10 },
  metricLabel: { color: '#94a3b8', fontSize: 12, flex: 1 },
  metricValue: { color: '#f8fafc', fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 },
  walletNote: { color: '#64748b', fontSize: 10, lineHeight: 15, marginTop: 10 },
  positive: { color: '#4ade80', fontWeight: '800' },
  attention: { color: '#fbbf24', fontWeight: '800' },
  neutral: { color: '#94a3b8', fontWeight: '700' },
  technicalToggle: { borderWidth: 1, borderColor: '#334155', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 12 },
  technicalToggleText: { color: '#94a3b8', fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 10, lineHeight: 15, marginTop: 6 },
  rawBlock: { backgroundColor: '#0a1115', borderWidth: 1, borderColor: '#202a30', borderRadius: 12, padding: 11, marginTop: 10 },
  rawHeading: { color: '#cbd5e1', fontSize: 10, fontWeight: '900' },
  rawMeta: { color: '#64748b', fontSize: 9, marginTop: 4 },
  rawText: { color: '#93c5fd', fontSize: 10, lineHeight: 15, marginTop: 7, fontFamily: 'monospace' },
});
