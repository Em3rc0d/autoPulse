import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { DiagnosticCheckReportRepository } from '../../infrastructure/database/product/repositories/diagnostic-check-report.repository';
import {
  DiagnosticCheckReportService,
  type DiagnosticCheckReportResult,
} from '../../application/check/DiagnosticCheckReportService';
import {
  runCheckPhysicalPilotV4,
  type CheckAdaptiveProgress,
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
import { CHECK_V4_PID_WALLET } from '../../application/check/intelligence/PidWallet';
import type { DiagnosticConcernV2 } from '../../application/check/intelligence/DiagnosticConcernEngine';
import { uiText, useUiLanguage } from '../../application/localization/UiLanguage';
import {
  checkErrorMessage,
  isRecoverableCheckTransportFailure,
} from '../../application/check/live/CheckTransportRecovery';

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

function ConcernCard({ concern, t }: { concern: DiagnosticConcernV2; t: (en: string, es: string) => string }) {
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
          <Text style={styles.smallHeading}>{t('Related evidence','Evidencia relacionada')}</Text>
          {concern.relatedEvidence.slice(0, 5).map(item => (
            <Text key={`${concern.code}-${item.requestId}`} style={styles.compactLine}>{formatDecodedPidObservation(item)}</Text>
          ))}
        </View>
      ) : <Text style={styles.muted}>No additional targeted PID evidence was established for this concern.</Text>}
      <Text style={styles.smallHeading}>{t('Possible systems','Sistemas posibles')}</Text>
      <Text style={styles.body}>{concern.possibleSystemGroups.join(' · ')}</Text>
      <Text style={styles.causeLimit}>{t('Exact cause not established','Causa exacta no establecida')}</Text>
      {concern.limitations.map(item => <Text key={item} style={styles.muted}>• {item}</Text>)}
    </View>
  );
}

export default function CheckRunScreen() {
  const navigation = useNavigation<any>();
  const language = useUiLanguage();
  const t = (en: string, es: string) => uiText(language, en, es);
  const route = useRoute<any>();
  const vehicleId = route.params?.vehicleId as string | undefined;
  const connectionHandleId = route.params?.connectionHandleId as string | undefined;
  const { vehicle } = useVehicle(vehicleId);
  const db = useProductDb();
  const { context } = useLocalContext();
  const workspaceId = context?.defaultWorkspaceId as string | undefined;
  const [uiState, setUiState] = useState<UiState>('IDLE');
  const [stage, setStage] = useState<CheckPhysicalPilotStageV4 | null>(null);
  const [adaptiveProgress, setAdaptiveProgress] = useState<CheckAdaptiveProgress>({ selected: 0, completed: 0 });
  const [result, setResult] = useState<CheckPhysicalPilotV4Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [sealedReport, setSealedReport] = useState<DiagnosticCheckReportResult | null>(null);
  const cancellationRef = useRef(new CheckPilotCancellationToken());
  const controllerRef = useRef<RealObdController | null>(null);
  useEffect(() => () => {
    cancellationRef.current.cancel();
    controllerRef.current?.disconnect();
    controllerRef.current = null;

    // Never tear down a BLE link that a newer workflow has already claimed.
    // The current Check screen may only release resources it still owns.
    if (activeBleController.getOwner() === 'CHECK') {
      activeBleController.releaseClaim('CHECK');
    }
  }, []);

  const executePilotAttempt = async () => {
    if (!connectionHandleId) throw new Error('CHECK_CONNECTION_HANDLE_MISSING');
    const connection = activeBleController.getConnection(connectionHandleId);
    if (!connection) throw new Error('CHECK_CONNECTION_NOT_AVAILABLE');

    controllerRef.current?.disconnect();
    const controller = new RealObdController(connection);
    controllerRef.current = controller;

    try {
      return await runCheckPhysicalPilotV4({
        controller,
        connectionHandleId,
        cancellation: cancellationRef.current,
        onStage: setStage,
        onAdaptiveProgress: setAdaptiveProgress,
      });
    } finally {
      // A failed attempt must not leave an ElmAccumulator monitor subscribed.
      // Retaining the BLE link is separate from retaining a command controller.
      controller.disconnect();
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const run = async () => {
    if (!connectionHandleId || !activeBleController.getConnection(connectionHandleId)) {
      setError('The retained OBD connection is no longer available. Reconnect the adapter.');
      setUiState('ERROR');
      return;
    }

    if (!db || !workspaceId || !vehicleId) {
      setError(t('Local evidence storage is not ready yet. Retry in a moment.','El almacenamiento local de evidencia aún no está listo. Intenta nuevamente.'));
      setUiState('ERROR');
      return;
    }

    const leasedConnection = activeBleController.claimConnection(connectionHandleId, 'CHECK');
    if (!leasedConnection) {
      setError('The OBD adapter is currently owned by another AutoPulse workflow.');
      setUiState('ERROR');
      return;
    }

    setError(null);
    setResult(null);
    setSealedReport(null);
    setShowTechnical(false);
    setAdaptiveProgress({ selected: 0, completed: 0 });
    setStage('PREPARING_ADAPTER');
    setUiState('RUNNING');
    cancellationRef.current = new CheckPilotCancellationToken();

    try {
      let pilotResult: CheckPhysicalPilotV4Result;
      try {
        pilotResult = await executePilotAttempt();
      } catch (firstFailure) {
        if (
          cancellationRef.current.isCancelled ||
          !isRecoverableCheckTransportFailure(firstFailure)
        ) {
          throw firstFailure;
        }

        setStage('PREPARING_ADAPTER');
        const recovered = await activeBleController.reconnectClaimedConnection(
          connectionHandleId,
          'CHECK',
        );
        if (!recovered) {
          throw new Error(`CHECK_TRANSPORT_RECOVERY_FAILED:${checkErrorMessage(firstFailure)}`);
        }

        // Exactly one clean retry. CheckPhysicalPilot re-runs ATE0/ATL0/ATS0/ATH0,
        // ATSP0, 0100 bootstrap and protocol discovery on the rebuilt BLE link.
        pilotResult = await executePilotAttempt();
      }

      if (cancellationRef.current.isCancelled) {
        setResult(pilotResult);
        setUiState('CANCELLED');
      } else {
        const reportService = new DiagnosticCheckReportService(
          new DiagnosticCheckReportRepository(db),
        );
        const report = await reportService.create({
          workspaceId,
          vehicle: {
            vehicleId,
            alias: vehicle?.alias,
            make: vehicle?.make,
            model: vehicle?.model,
            year: vehicle?.year,
          },
          result: pilotResult,
        });
        setResult(pilotResult);
        setSealedReport(report);
        setUiState('COMPLETE');
      }
    } catch (reason) {
      if (cancellationRef.current.isCancelled) {
        setUiState('CANCELLED');
        setError(null);
      } else {
        setError(checkErrorMessage(reason) || 'Check stopped safely.');
        setUiState('ERROR');
      }
    } finally {
      // Check no longer owns the adapter once an attempt reaches a terminal UI
      // state. The physical BLE link may remain idle for Live/Check reuse.
      activeBleController.releaseClaim('CHECK');
    }
  };

  const cancel = () => {
    cancellationRef.current.cancel();
    setUiState('CANCELLING');
  };

  const scanPresentation = result ? presentCheckScanState(result.scan.state) : null;
  const capabilityPresentation = result ? presentCapabilityAssessment(result.capabilityAssessment) : null;
  const issueCount = result?.concerns.length ?? 0;
  const selectedTargetedCount = result?.targetedEvidencePlan.requests.length ?? 0;
  const executedTargetedCount = result?.targetedEvidenceScan?.usage.commandsIssued ?? 0;
  const targetedExecutionIncomplete = selectedTargetedCount > executedTargetedCount;
  const promotedReaderCount = CHECK_V4_PID_WALLET.filter(item => item.executableInCheckV4).length;
  const observedPidCount = result?.decodedPidEvidence.length ?? 0;
  const directObservedCount = result?.directObservationCommandCount ?? 0;
  const totalVehicleDataSelected = selectedTargetedCount + directObservedCount;
  const totalVehicleDataExecuted = executedTargetedCount + directObservedCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>← Check</Text>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{t('ECU CHECK · ADAPTIVE READ ONLY','CHECK ECU · ADAPTATIVO SOLO LECTURA')}</Text>
            <Text style={styles.title}>{vehicle?.alias ?? 'Vehicle'} Check</Text>
          </View>
          <Text style={styles.readOnlyBadge}>{t('READ ONLY','SOLO LECTURA')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {uiState === 'IDLE' ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('Ready','Listo')}</Text>
            <Text style={styles.body}>{t('AutoPulse will read standard ECU diagnostics, emissions readiness and a bounded adaptive vehicle-data snapshot. If the ECU reports a concern, relevant evidence gets priority.','AutoPulse leerá diagnósticos ECU estándar, readiness de emisiones y un snapshot adaptativo acotado de datos del vehículo. Si la ECU reporta un hallazgo, la evidencia relacionada tendrá prioridad.')}</Text>
            <Text style={styles.safetyText}>{t('Parked vehicle only. Clear, reset, control, coding and write operations remain blocked.','Solo con el vehículo estacionado. Borrado, reinicio, control, codificación y escritura permanecen bloqueados.')}</Text>
            <TouchableOpacity style={styles.primary} onPress={() => void run()} testID="run-physical-check">
              <Text style={styles.primaryText}>{t('Run Check','Ejecutar Check')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(uiState === 'RUNNING' || uiState === 'CANCELLING') ? (
          <View style={styles.panel}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.panelTitle}>{uiState === 'CANCELLING' ? 'Cancelling safely…' : stage ? stageLabel[stage] : 'Running Check…'}</Text>
            {stage === 'RUNNING_TARGETED_EVIDENCE' && adaptiveProgress.selected > 0 ? (
              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round((adaptiveProgress.completed / adaptiveProgress.selected) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {adaptiveProgress.completed} / {adaptiveProgress.selected} {t('adaptive reads completed','lecturas adaptativas completadas')}
                </Text>
              </View>
            ) : null}
            <Text style={styles.body}>{t('Serial · bounded · adaptive · descriptor-gated · no blind PID sweep','Serial · acotado · adaptativo · descriptor-gated · sin barrido ciego de PIDs')}</Text>
            {uiState === 'RUNNING' ? <TouchableOpacity style={styles.secondary} onPress={cancel}><Text style={styles.secondaryText}>{t('Cancel Check','Cancelar Check')}</Text></TouchableOpacity> : null}
          </View>
        ) : null}

        {uiState === 'CANCELLED' ? <View style={styles.panel}><Text style={styles.panelTitle}>{t('Check cancelled','Check cancelado')}</Text><Text style={styles.body}>{t('No additional request will be issued.','No se enviarán solicitudes adicionales.')}</Text></View> : null}

        {uiState === 'ERROR' ? (
          <View style={styles.panel}>
            <Text style={styles.errorTitle}>{t('Check stopped safely','Check detenido de forma segura')}</Text>
            <Text style={styles.body}>{error}</Text>
            <TouchableOpacity style={styles.secondary} onPress={() => void run()}><Text style={styles.secondaryText}>{t('Retry Check','Reintentar Check')}</Text></TouchableOpacity>
          </View>
        ) : null}

        {result && uiState === 'COMPLETE' && scanPresentation && capabilityPresentation ? (
          <>
            <View style={issueCount > 0 ? styles.summaryAttention : styles.summaryGood}>
              <Text style={styles.summaryKicker}>{issueCount > 0 ? `${issueCount} diagnostic issue${issueCount === 1 ? '' : 's'} reported` : 'No diagnostic codes reported'}</Text>
              <Text style={styles.body}>{issueCount > 0 ? 'ECU-recorded conditions are shown below with targeted evidence. Root cause is not assumed.' : 'The successfully scanned standard DTC services did not report a code.'}</Text>
              <Text style={styles.scopeNote}>{scanPresentation.label} · {result.protocol}</Text>
            </View>

            {result.concerns.map(concern => <ConcernCard key={concern.concernId} concern={concern} t={t} />)}

            <View style={styles.coveragePanel}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.panelTitle}>{t('Adaptive scan coverage','Cobertura del scan adaptativo')}</Text>
                  <Text style={styles.muted}>{t('Useful evidence is selected from the promoted read-only wallet; unsupported or unavailable signals remain explicit.','La evidencia útil se selecciona de la wallet read-only promovida; señales no soportadas o no disponibles permanecen explícitas.')}</Text>
                </View>
                <Text style={styles.coverageBadge}>{result.protocol.replace('ISO_', '')}</Text>
              </View>
              <View style={styles.coverageGrid}>
                <View style={styles.coverageMetric}><Text style={styles.coverageNumber}>{result.scanCommandCount}</Text><Text style={styles.coverageLabel}>{t('CORE','CORE')}</Text></View>
                <View style={styles.coverageMetric}><Text style={styles.coverageNumber}>{totalVehicleDataSelected}</Text><Text style={styles.coverageLabel}>{t('SELECTED','SELECCIONADOS')}</Text></View>
                <View style={styles.coverageMetric}><Text style={styles.coverageNumber}>{totalVehicleDataExecuted}</Text><Text style={styles.coverageLabel}>{t('EXECUTED','EJECUTADOS')}</Text></View>
                <View style={styles.coverageMetric}><Text style={styles.coverageNumber}>{observedPidCount}</Text><Text style={styles.coverageLabel}>{t('OBSERVED','OBSERVADOS')}</Text></View>
              </View>
              <Text style={styles.walletNote}>{CHECK_V4_PID_WALLET.length} reference PIDs · {promotedReaderCount} promoted deterministic readers · max 18 adaptive requests per enrichment phase · no writes.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t('Current ECU evidence','Evidencia actual de ECU')}</Text>
              {result.decodedPidEvidence.length > 0 ? result.decodedPidEvidence.map(item => (
                <View key={`${item.requestId}-${item.sourceEndpointId ?? 'u'}`} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{item.name}</Text>
                  <Text style={styles.metricValue}>{formatDecodedPidObservation(item).replace(`${item.signals[0]?.label}: `, '')}</Text>
                </View>
              )) : <Text style={styles.muted}>{t('No promoted current-data value was established.','No se estableció un valor actual promovido.')}</Text>}
              <Text style={targetedExecutionIncomplete ? styles.targetedUnavailable : styles.walletNote}>
                {selectedTargetedCount} adaptive PID request{selectedTargetedCount === 1 ? '' : 's'} selected · {executedTargetedCount} executed · {directObservedCount} direct corroboration. {targetedExecutionIncomplete ? 'Adaptive evidence was not fully acquired in this run. ' : ''}No blind sweep.
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t('Emissions readiness','Preparación de emisiones')}</Text>
              {result.readiness ? (
                <>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>MIL</Text><Text style={result.readiness.milOn ? styles.attention : styles.positive}>{result.readiness.milOn ? 'ON' : 'OFF'}</Text></View>
                  <View style={styles.metricRow}><Text style={styles.metricLabel}>Confirmed DTC count</Text><Text style={styles.metricValue}>{result.readiness.confirmedDtcCount}</Text></View>
                  {result.readiness.monitors.map(monitor => (
                    <View key={monitor.id} style={styles.metricRow}><Text style={styles.metricLabel}>{monitor.label}</Text><Text style={monitor.state === 'READY' ? styles.positive : monitor.state === 'NOT_READY' ? styles.attention : styles.neutral}>{monitor.state.replace('_', ' ')}</Text></View>
                  ))}
                </>
              ) : <Text style={styles.muted}>{targetedExecutionIncomplete && result.targetedEvidencePlan.requests.some(item => item.pid === '01') ? 'Readiness was selected but not executed successfully in this run.' : 'Readiness was not established from a validated PID 0101 response.'}</Text>}
              <Text style={styles.scopeNote}>NOT READY means the monitor has not completed; it does not mean the monitor failed.</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t('Standard OBD coverage','Cobertura OBD estándar')}</Text>
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
              <Text style={styles.panelTitle}>{t('Scope','Alcance')}</Text>
              <Text style={styles.muted}>{t('Standard OBD evidence only. AutoPulse now gathers a bounded adaptive current-data snapshot, but unsupported modules are never called healthy. Mode 06, Freeze Frame and manufacturer-enhanced modules remain gated rather than guessed.','Solo evidencia OBD estándar. AutoPulse ahora obtiene un snapshot adaptativo acotado de datos actuales, pero módulos no soportados nunca se declaran saludables. Mode 06, Freeze Frame y módulos manufacturer-enhanced permanecen gated en vez de adivinarse.')}</Text>
            </View>

            {sealedReport ? (
              <View style={styles.sealedPanel}>
                <Text style={styles.sealedTitle}>{t('SEALED CHECK','CHECK SELLADO')}</Text>
                <Text style={styles.body}>{t('This physical Check is stored locally as immutable evidence and can be verified after reopening the app.','Este Check físico se guardó localmente como evidencia inmutable y puede verificarse después de reabrir la app.')}</Text>
                <Text selectable style={styles.hash}>{sealedReport.sha256}</Text>
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={() => navigation.navigate('DiagnosticCheckReport', { checkId: sealedReport.snapshot.checkId })}
                  testID="open-sealed-diagnostic-check"
                >
                  <Text style={styles.secondaryText}>{t('Open sealed report','Abrir reporte sellado')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity style={styles.technicalToggle} onPress={() => setShowTechnical(value => !value)} testID="toggle-check-technical-details">
              <Text style={styles.technicalToggleText}>{showTechnical ? 'Hide technical evidence' : 'Show technical evidence'}</Text>
            </TouchableOpacity>

            {showTechnical ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{t('Technical evidence','Evidencia técnica')}</Text>
                <Text style={styles.meta}>Check engine: {result.pilotVersion}</Text>
                <Text style={styles.meta}>Protocol evidence: {result.protocolEvidence || 'not retained'}</Text>
                <Text style={styles.meta}>Core commands: {result.scanCommandCount}</Text>
                <Text style={styles.meta}>Direct corroboration commands: {result.directObservationCommandCount}</Text>
                <Text style={styles.meta}>Adaptive selected: {selectedTargetedCount}</Text>
                <Text style={styles.meta}>Adaptive executed: {executedTargetedCount}</Text>
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
  coveragePanel: { backgroundColor: '#101d22', borderWidth: 1, borderColor: '#1f4b5b', borderRadius: 16, padding: 15, marginBottom: 12 },
  progressBlock: { width: '100%', marginTop: 14, marginBottom: 10 },
  progressTrack: { width: '100%', height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: '#1e293b' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#4ade80' },
  progressText: { color: '#94a3b8', fontSize: 10, marginTop: 7, textAlign: 'center', fontWeight: '700' },
  sealedPanel: { backgroundColor: '#0c2317', borderWidth: 1, borderColor: '#166534', borderRadius: 16, padding: 15, marginBottom: 12 },
  sealedTitle: { color: '#86efac', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  hash: { color: '#93c5fd', fontSize: 9, lineHeight: 15, marginTop: 10, fontFamily: 'monospace' },
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
  coverageBadge: { color: '#67e8f9', borderWidth: 1, borderColor: '#155e75', backgroundColor: '#083344', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, fontWeight: '900', overflow: 'hidden' },
  coverageGrid: { flexDirection: 'row', gap: 6, marginTop: 14 },
  coverageMetric: { flex: 1, minHeight: 58, borderRadius: 12, backgroundColor: '#0b1418', borderWidth: 1, borderColor: '#263139', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  coverageNumber: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
  coverageLabel: { color: '#64748b', fontSize: 7, fontWeight: '900', letterSpacing: 0.6, marginTop: 2, textAlign: 'center' },
  walletNote: { color: '#64748b', fontSize: 10, lineHeight: 15, marginTop: 10 },
  targetedUnavailable: { color: '#fbbf24', fontSize: 10, lineHeight: 15, marginTop: 10 },
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
