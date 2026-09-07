import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import {
  CheckPhysicalPilotResult,
  CheckPhysicalPilotStage,
  runCheckPhysicalPilot,
} from '../../application/check/live/CheckPhysicalPilot';
import { CheckPilotCancellationToken } from '../../application/check/live/RealCheckPlannedExecutor';
import type { DtcServiceParseResult } from '../../application/check/parsers/DtcServiceParser';
import type { Mode01DirectObservationResult } from '../../application/check/parsers/Mode01DirectObservationParser';
import {
  presentCapabilityAssessment,
  presentCheckScanState,
  presentDirectMode01Observation,
  presentDtcResult,
  technicalDtcOutcome,
} from '../../application/check/live/CheckPilotPresentation';

type UiState = 'IDLE' | 'RUNNING' | 'CANCELLING' | 'COMPLETE' | 'ERROR' | 'CANCELLED';

const stageLabel: Record<CheckPhysicalPilotStage, string> = {
  PREPARING_ADAPTER: 'Preparing read-only adapter channel',
  NEGOTIATING_PROTOCOL: 'Discovering vehicle protocol',
  RUNNING_STANDARD_SCAN: 'Reading standard ECU diagnostic evidence',
  RUNNING_DIRECT_PID_CORROBORATION: 'Corroborating exact Mode 01 observations',
  SEALING_PILOT_RESULT: 'Sealing diagnostic evidence',
};

const directPidLabel: Readonly<Record<string, string>> = Object.freeze({
  '05': 'Engine coolant',
  '0C': 'Engine RPM',
  '0D': 'Vehicle speed',
});

function toneStyle(tone: 'POSITIVE' | 'ATTENTION' | 'NEUTRAL') {
  if (tone === 'POSITIVE') return styles.observed;
  if (tone === 'ATTENTION') return styles.attention;
  return styles.neutral;
}

function DtcEvidenceCard({ result, showTechnical }: { result: DtcServiceParseResult; showTechnical: boolean }) {
  const label = result.status === 'STORED' ? 'Stored DTCs' : result.status === 'PENDING' ? 'Pending DTCs' : 'Permanent DTCs';
  const presentation = presentDtcResult(result);
  return (
    <View style={styles.evidenceCard}>
      <Text style={styles.evidenceTitle}>{label}</Text>
      <Text style={[styles.resultLabel, toneStyle(presentation.tone)]}>{presentation.label}</Text>
      <Text style={styles.body}>{presentation.detail}</Text>
      {result.outcome === 'SUCCESS_WITH_CODES' ? (
        <View style={styles.codes}>
          {result.codes.map(code => <Text key={code.code} style={styles.code}>{code.code}</Text>)}
        </View>
      ) : null}
      {showTechnical ? (
        <View style={styles.technicalInset}>
          <Text style={styles.meta}>Outcome: {technicalDtcOutcome(result)}</Text>
          <Text style={styles.meta}>Source ECU: {result.sourceEndpointId ?? 'UNATTRIBUTED'} · service {result.requestService}</Text>
          {result.limitation ? <Text style={styles.meta}>Parser: {result.limitation}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function DirectObservationCard({ result, showTechnical }: { result: Mode01DirectObservationResult; showTechnical: boolean }) {
  const presentation = presentDirectMode01Observation(result);
  const pid = result.requestPid.toUpperCase();
  return (
    <View style={styles.evidenceCard}>
      <Text style={styles.evidenceTitle}>{directPidLabel[pid] ?? `Mode 01 PID ${pid}`}</Text>
      <Text style={styles.pidCaption}>PID 01{pid}</Text>
      <Text style={[styles.resultLabel, toneStyle(presentation.tone)]}>{presentation.label}</Text>
      <Text style={styles.body}>{presentation.detail}</Text>
      {showTechnical ? (
        <View style={styles.technicalInset}>
          <Text style={styles.meta}>Outcome: {result.outcome}</Text>
          <Text style={styles.meta}>Source ECU: {result.sourceEndpointId ?? 'UNATTRIBUTED'}</Text>
          {result.dataBytes.length > 0 ? <Text style={styles.meta}>Data bytes: {result.dataBytes.map(value => value.toString(16).padStart(2, '0').toUpperCase()).join(' ')}</Text> : null}
          {result.negativeResponseCode ? <Text style={styles.meta}>NRC: {result.negativeResponseCode}</Text> : null}
          {result.limitation ? <Text style={styles.meta}>Parser: {result.limitation}</Text> : null}
        </View>
      ) : null}
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
  const [stage, setStage] = useState<CheckPhysicalPilotStage | null>(null);
  const [result, setResult] = useState<CheckPhysicalPilotResult | null>(null);
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
      const pilotResult = await runCheckPhysicalPilot({
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
        setError(reason instanceof Error ? reason.message : 'Check pilot failed safely.');
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
  const directResults = result?.directObservationScan?.mode01DirectResults ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>← Check</Text>
        <Text style={styles.eyebrow}>ECU CHECK · PHYSICAL PILOT</Text>
        <Text style={styles.title}>{vehicle?.alias ?? 'Vehicle'} Check</Text>
        <Text style={styles.subtitle}>Current ECU diagnostic evidence. Independent from Live sessions.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>PARKED ONLY</Text>
          <Text style={styles.body}>Run Check only while the vehicle is stationary. AutoPulse uses descriptor-gated read-only OBD requests; clear, reset and control commands remain blocked.</Text>
        </View>

        {uiState === 'IDLE' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Ready to query the ECU</Text>
            <Text style={styles.body}>This pilot reads standard PID capability evidence plus stored, pending and permanent DTC services. When a proven KWP path returns a valid empty support bitmap, AutoPulse may corroborate only a small exact allowlist of Mode 01 PIDs as direct observations.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => void run()} testID="run-physical-check">
              <Text style={styles.primaryText}>Run Check</Text>
            </TouchableOpacity>
          </View>
        )}

        {(uiState === 'RUNNING' || uiState === 'CANCELLING') && (
          <View style={styles.panel}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.panelTitle}>{uiState === 'CANCELLING' ? 'Cancelling safely…' : stage ? stageLabel[stage] : 'Running Check…'}</Text>
            <Text style={styles.body}>{uiState === 'CANCELLING' ? 'The current bounded request may finish; no next request will be issued.' : 'Serial execution · bounded response/time budget · no automatic resend.'}</Text>
            {uiState === 'RUNNING' ? <TouchableOpacity style={styles.secondary} onPress={cancel}><Text style={styles.secondaryText}>Cancel Check</Text></TouchableOpacity> : null}
          </View>
        )}

        {uiState === 'CANCELLED' && (
          <View style={styles.panel}><Text style={styles.attentionLarge}>Check cancelled</Text><Text style={styles.body}>No additional diagnostic request will be issued.</Text></View>
        )}

        {uiState === 'ERROR' && (
          <View style={styles.panel}>
            <Text style={styles.errorLarge}>Check stopped safely</Text>
            <Text style={styles.body}>{error}</Text>
            <TouchableOpacity style={styles.secondary} onPress={() => void run()}><Text style={styles.secondaryText}>Retry Check</Text></TouchableOpacity>
          </View>
        )}

        {result && uiState === 'COMPLETE' && scanPresentation && capabilityPresentation && (
          <>
            <View style={styles.resultBox}>
              <Text style={[styles.resultHero, toneStyle(scanPresentation.tone)]}>{scanPresentation.label}</Text>
              <Text style={styles.body}>{scanPresentation.detail}</Text>
              <Text style={styles.scopeNote}>Diagnostic evidence only · not a mechanical PASS/FAIL verdict</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Standard OBD evidence</Text>
              <View style={styles.metric}><Text style={styles.metricLabel}>Protocol</Text><Text style={styles.metricValue}>{result.protocol}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>PID capability</Text><Text style={[styles.metricValue, toneStyle(capabilityPresentation.tone)]}>{capabilityPresentation.label}</Text></View>
              <Text style={styles.body}>{capabilityPresentation.detail}</Text>
              {result.capabilityAssessment.observations.map(observation => (
                <View key={`cap-${observation.observationIndex}`} style={styles.capabilityObservation}>
                  <Text style={styles.meta}>Response {observation.observationIndex + 1} · ECU {observation.sourceEndpointId ?? 'UNATTRIBUTED'} · {observation.outcome}</Text>
                  {observation.advertisedPids.length > 0
                    ? <Text style={styles.capabilityPidList}>{observation.advertisedPids.join(' · ')}</Text>
                    : observation.outcome === 'VALID'
                      ? <Text style={styles.meta}>Valid empty bitmap</Text>
                      : <Text style={styles.meta}>{observation.limitation ?? 'Capability response rejected'}</Text>}
                </View>
              ))}
            </View>

            {directResults.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Direct Mode 01 observations</Text>
                <View style={styles.directNotice}>
                  <Text style={styles.directNoticeTitle}>Corroboration, not advertised support</Text>
                  <Text style={styles.body}>These exact PIDs were queried individually because the support bitmap was valid but empty. A successful response proves only that exact PID was observed in this Check.</Text>
                </View>
                {directResults.map((item, index) => (
                  <DirectObservationCard
                    key={`direct-${item.requestPid}-${item.sourceEndpointId ?? 'u'}-${index}`}
                    result={item}
                    showTechnical={showTechnical}
                  />
                ))}
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Diagnostic codes</Text>
            {result.scan.dtcResults.length > 0
              ? result.scan.dtcResults.map((item, index) => <DtcEvidenceCard key={`${item.status}-${item.sourceEndpointId ?? 'u'}-${index}`} result={item} showTechnical={showTechnical} />)
              : <View style={styles.panel}><Text style={styles.body}>No DTC list was established. This does not mean the vehicle has no faults.</Text></View>}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Scope & limitations</Text>
              {result.userLimitations.map((item, index) => <Text key={`${index}-${item}`} style={styles.limitation}>• {item}</Text>)}
            </View>

            <TouchableOpacity style={styles.technicalToggle} onPress={() => setShowTechnical(value => !value)} testID="toggle-check-technical-details">
              <Text style={styles.technicalToggleText}>{showTechnical ? 'Hide technical evidence' : 'Show technical evidence'}</Text>
            </TouchableOpacity>

            {showTechnical ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Technical evidence</Text>
                <Text style={styles.meta}>Pilot: {result.pilotVersion}</Text>
                <Text style={styles.meta}>Protocol evidence: {result.protocolEvidence || 'not retained'}</Text>
                <Text style={styles.meta}>Bootstrap OBD command: 1 · {result.bootstrapStandardObdStatus}</Text>
                <Text style={styles.meta}>Core scan commands: {result.scanCommandCount}</Text>
                <Text style={styles.meta}>Direct-observation commands: {result.directObservationCommandCount}</Text>
                <Text style={styles.meta}>Core normalized response records: {result.scan.attempts.length}</Text>
                <Text style={styles.meta}>Core response bytes: {result.scan.usage.responseBytes}</Text>
                {result.directObservationScan ? <Text style={styles.meta}>Direct response bytes: {result.directObservationScan.usage.responseBytes}</Text> : null}

                {result.rawEvidence.map((evidence, index) => (
                  <View key={`${evidence.phase}-${evidence.semanticId}-${index}`} style={styles.rawBlock}>
                    <Text style={styles.rawHeading}>{evidence.phase} · {evidence.service}{evidence.pid ?? ''} · {evidence.responseKind}</Text>
                    <Text style={styles.rawMeta}>ECU {evidence.sourceEndpointId ?? 'UNATTRIBUTED'} · {evidence.observedResponseBytes} bytes</Text>
                    <Text selectable style={styles.rawText}>{evidence.rawText ?? 'No raw diagnostic text retained'}</Text>
                  </View>
                ))}

                {result.technicalLimitations.length > 0 ? (
                  <>
                    <Text style={styles.technicalSectionLabel}>Engine limitations</Text>
                    {result.technicalLimitations.map((item, index) => <Text key={`${index}-${item}`} style={styles.meta}>• {item}</Text>)}
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  back: { color: '#60a5fa', fontSize: 14, fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 7 },
  content: { padding: 18, paddingBottom: 64 },
  safetyBox: { backgroundColor: '#211a0c', borderWidth: 1, borderColor: '#854d0e', borderRadius: 16, padding: 16, marginBottom: 16 },
  safetyTitle: { color: '#fbbf24', fontWeight: '900', letterSpacing: 1 },
  panel: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 16 },
  resultBox: { backgroundColor: '#0c2a1a', borderWidth: 1, borderColor: '#166534', borderRadius: 16, padding: 18, marginBottom: 16 },
  panelTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 18, marginTop: 4 },
  body: { color: '#cbd5e1', lineHeight: 20, marginTop: 8 },
  scopeNote: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 12 },
  meta: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 7 },
  primary: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#475569', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  secondaryText: { color: '#e2e8f0', fontWeight: '800' },
  resultHero: { fontWeight: '900', fontSize: 24 },
  attentionLarge: { color: '#fbbf24', fontWeight: '900', fontSize: 22 },
  errorLarge: { color: '#fca5a5', fontWeight: '900', fontSize: 20 },
  sectionTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 20, marginBottom: 10, marginTop: 4 },
  evidenceCard: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 12 },
  evidenceTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 17 },
  pidCaption: { color: '#64748b', fontSize: 11, marginTop: 4 },
  resultLabel: { fontWeight: '900', fontSize: 13, marginTop: 9 },
  observed: { color: '#4ade80' },
  attention: { color: '#fbbf24' },
  neutral: { color: '#94a3b8' },
  codes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  code: { color: '#fff', backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontWeight: '900', fontSize: 15 },
  metric: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#202a30', paddingVertical: 12 },
  metricLabel: { color: '#94a3b8' },
  metricValue: { color: '#f8fafc', fontWeight: '800', textAlign: 'right', flex: 1 },
  limitation: { color: '#cbd5e1', lineHeight: 20, marginTop: 8 },
  capabilityObservation: { borderTopWidth: 1, borderTopColor: '#202a30', marginTop: 12, paddingTop: 8 },
  capabilityPidList: { color: '#93c5fd', fontSize: 11, lineHeight: 17, marginTop: 6 },
  directNotice: { backgroundColor: '#0f1c24', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 14, marginBottom: 12 },
  directNoticeTitle: { color: '#93c5fd', fontWeight: '900', fontSize: 13 },
  technicalInset: { borderTopWidth: 1, borderTopColor: '#263139', marginTop: 12, paddingTop: 6 },
  technicalToggle: { borderWidth: 1, borderColor: '#334155', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  technicalToggleText: { color: '#94a3b8', fontWeight: '800' },
  technicalSectionLabel: { color: '#94a3b8', fontWeight: '800', marginTop: 18, marginBottom: 4 },
  rawBlock: { backgroundColor: '#0a1115', borderWidth: 1, borderColor: '#202a30', borderRadius: 12, padding: 12, marginTop: 12 },
  rawHeading: { color: '#cbd5e1', fontSize: 11, fontWeight: '900' },
  rawMeta: { color: '#64748b', fontSize: 10, marginTop: 4 },
  rawText: { color: '#93c5fd', fontSize: 11, lineHeight: 16, marginTop: 8, fontFamily: 'monospace' },
});