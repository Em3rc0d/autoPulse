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

type UiState = 'IDLE' | 'RUNNING' | 'CANCELLING' | 'COMPLETE' | 'ERROR' | 'CANCELLED';

const stageLabel: Record<CheckPhysicalPilotStage, string> = {
  PREPARING_ADAPTER: 'Preparing read-only adapter channel',
  NEGOTIATING_PROTOCOL: 'Discovering vehicle protocol',
  RUNNING_DTC_SCAN: 'Scanning standard ECU diagnostic evidence',
  SEALING_PILOT_RESULT: 'Sealing pilot result',
};

function DtcEvidenceCard({ result }: { result: DtcServiceParseResult }) {
  const label = result.status === 'STORED' ? 'Stored DTCs' : result.status === 'PENDING' ? 'Pending DTCs' : 'Permanent DTCs';
  return (
    <View style={styles.evidenceCard}>
      <View style={styles.row}>
        <Text style={styles.evidenceTitle}>{label}</Text>
        <Text style={result.outcome.startsWith('SUCCESS') ? styles.observed : styles.limited}>{result.outcome}</Text>
      </View>
      <Text style={styles.meta}>Source ECU: {result.sourceEndpointId ?? 'UNATTRIBUTED'} · service {result.requestService}</Text>
      {result.outcome === 'SUCCESS_WITH_CODES' ? (
        <View style={styles.codes}>
          {result.codes.map(code => <Text key={code.code} style={styles.code}>{code.code}</Text>)}
        </View>
      ) : result.outcome === 'SUCCESS_ZERO_CODES' ? (
        <Text style={styles.body}>No {result.status.toLowerCase()} DTCs were reported by this scanned response.</Text>
      ) : (
        <Text style={styles.body}>{result.limitation ?? 'No positive diagnostic list was established for this service.'}</Text>
      )}
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

  const pidSupport = result?.scan.pidSupportResults[0];

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
          <Text style={styles.body}>Run this pilot only while the vehicle is stationary. AutoPulse will use descriptor-gated read-only OBD requests; clear/reset/control commands remain blocked.</Text>
        </View>

        {uiState === 'IDLE' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Ready to query the ECU</Text>
            <Text style={styles.body}>This first physical set checks standard PID support plus stored, pending and permanent DTC services only where their protocol/parser path is promoted.</Text>
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
          <View style={styles.panel}><Text style={styles.limitedLarge}>CHECK CANCELLED</Text><Text style={styles.body}>No additional diagnostic request will be issued.</Text></View>
        )}

        {uiState === 'ERROR' && (
          <View style={styles.panel}>
            <Text style={styles.errorLarge}>CHECK STOPPED SAFELY</Text>
            <Text style={styles.body}>{error}</Text>
            <TouchableOpacity style={styles.secondary} onPress={() => void run()}><Text style={styles.secondaryText}>Retry Check</Text></TouchableOpacity>
          </View>
        )}

        {result && uiState === 'COMPLETE' && (
          <>
            <View style={styles.resultBox}>
              <Text style={result.scan.state === 'COMPLETE' ? styles.goodLarge : styles.limitedLarge}>{result.scan.state}</Text>
              <Text style={styles.panelTitle}>ECU diagnostic evidence acquired</Text>
              <Text style={styles.body}>This is not a mechanical PASS/FAIL verdict.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Scan evidence</Text>
              <View style={styles.metric}><Text style={styles.metricLabel}>Protocol</Text><Text style={styles.metricValue}>{result.protocol}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Commands issued</Text><Text style={styles.metricValue}>{result.scan.usage.commandsIssued}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Responses</Text><Text style={styles.metricValue}>{result.scan.attempts.length}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Mode 01 support</Text><Text style={styles.metricValue}>{pidSupport?.outcome === 'VALID' ? `${pidSupport.advertisedPids.length} advertised` : 'Not established'}</Text></View>
              <Text style={styles.meta}>Protocol evidence: {result.protocolEvidence || 'not retained'}</Text>
            </View>

            <Text style={styles.sectionTitle}>DTC evidence</Text>
            {result.scan.dtcResults.length > 0
              ? result.scan.dtcResults.map((item, index) => <DtcEvidenceCard key={`${item.status}-${item.sourceEndpointId ?? 'u'}-${index}`} result={item} />)
              : <View style={styles.panel}><Text style={styles.body}>No DTC list was established. This does not mean the vehicle has no faults.</Text></View>}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Limitations</Text>
              {result.limitations.map((item, index) => <Text key={`${index}-${item}`} style={styles.limitation}>• {item}</Text>)}
            </View>
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
  panelTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 18, marginTop: 8 },
  body: { color: '#cbd5e1', lineHeight: 20, marginTop: 8 },
  meta: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: 7 },
  primary: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#475569', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  secondaryText: { color: '#e2e8f0', fontWeight: '800' },
  goodLarge: { color: '#4ade80', fontWeight: '900', fontSize: 28 },
  limitedLarge: { color: '#fbbf24', fontWeight: '900', fontSize: 22 },
  errorLarge: { color: '#fca5a5', fontWeight: '900', fontSize: 20 },
  sectionTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 20, marginBottom: 10, marginTop: 4 },
  evidenceCard: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  evidenceTitle: { color: '#f8fafc', fontWeight: '900', fontSize: 17, flex: 1 },
  observed: { color: '#4ade80', fontWeight: '900', fontSize: 10 },
  limited: { color: '#fbbf24', fontWeight: '900', fontSize: 10 },
  codes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  code: { color: '#fff', backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontWeight: '900', fontSize: 15 },
  metric: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#202a30', paddingVertical: 12 },
  metricLabel: { color: '#94a3b8' },
  metricValue: { color: '#f8fafc', fontWeight: '800', textAlign: 'right', flex: 1 },
  limitation: { color: '#cbd5e1', lineHeight: 20, marginTop: 8 },
});
