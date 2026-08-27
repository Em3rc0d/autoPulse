import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { StoredAutoPulseCheck } from '../../application/check/AutoPulseCheckEngine';
import {
  AutoPulseCheckPlanStep,
  buildAutoPulseCheckPlan,
} from '../../application/check/AutoPulseCheckPlan';
import { canAddEvidence } from '../../domain/evaluation/logic/evidencePolicy';
import { CaptureContext } from '../../domain/evaluation/models/enums';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { createEvaluationId } from '../../domain/shared/identifiers';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { VehicleRepository } from '../../infrastructure/database/product/repositories/vehicle.repository';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';

function evidenceForStep(step: AutoPulseCheckPlanStep, evidence: readonly EvidenceItem[]) {
  if (step.id === 'CAPABILITY_DISCOVERY') return evidence.find(item => item.type === 'OBD_CAPABILITY_DISCOVERY');
  if (step.id === 'DTC_SCAN') return evidence.find(item => item.type === 'OBD_STORED_DTC_SCAN');
  if (step.id === 'READINESS_SCAN') return evidence.find(item => item.type === 'OBD_MONITOR_STATUS_PID01');
  if (step.id === 'FREEZE_FRAME') return evidence.find(item => item.type === 'OBD_FREEZE_FRAME_TRIGGER');
  if (step.id === 'IDLE_TELEMETRY') {
    return evidence.find(item => item.type === 'LIVE_OBD_TELEMETRY_WINDOW' && item.metadata?.captureContext === CaptureContext.IDLE);
  }
  if (step.id === 'ROAD_TELEMETRY') {
    return evidence.find(item => item.type === 'LIVE_OBD_TELEMETRY_WINDOW' && item.metadata?.captureContext === CaptureContext.ROAD_TEST);
  }
  return undefined;
}

function statusForStep(step: AutoPulseCheckPlanStep, evidence: readonly EvidenceItem[]) {
  if (step.id === 'INTAKE') return { label: 'RECORDED', tone: 'good' as const };
  const item = evidenceForStep(step, evidence);
  if (item) {
    return item.state === 'FAILED'
      ? { label: 'CAPTURE FAILED', tone: 'bad' as const }
      : { label: 'EVIDENCE', tone: 'good' as const };
  }
  if (step.availability === 'UNAVAILABLE') return { label: 'UNAVAILABLE', tone: 'muted' as const };
  if (step.availability === 'UNKNOWN') return { label: 'UNKNOWN', tone: 'warn' as const };
  if (step.availability === 'CONDITIONAL') return { label: 'IF PRESENT', tone: 'warn' as const };
  return { label: 'PENDING', tone: 'pending' as const };
}

function evidenceSummary(item: EvidenceItem): string | null {
  if (item.type === 'OBD_CAPABILITY_DISCOVERY') {
    const pids = Array.isArray(item.metadata?.supportedPids) ? item.metadata?.supportedPids : [];
    const protocol = item.metadata?.protocol ?? 'unresolved';
    return `${pids.length} supported PID${pids.length === 1 ? '' : 's'} · protocol ${protocol}`;
  }

  if (item.type === 'OBD_STORED_DTC_SCAN') {
    const codes = Array.isArray(item.metadata?.diagnosticCodes) ? item.metadata?.diagnosticCodes : [];
    if (codes.length > 0) return `Stored DTCs: ${codes.join(', ')}`;
    return `Stored DTC service: ${item.metadata?.executionStatus ?? 'UNKNOWN'}`;
  }

  if (item.type === 'OBD_MONITOR_STATUS_PID01') {
    const monitor = item.metadata?.monitorStatus as { milOn?: boolean; confirmedDtcCount?: number } | null | undefined;
    if (monitor) return `MIL ${monitor.milOn ? 'ON' : 'OFF'} · confirmed DTC count ${monitor.confirmedDtcCount ?? '—'} · detailed readiness not decoded`;
    return `Monitor-status service: ${item.metadata?.executionStatus ?? 'UNKNOWN'}`;
  }

  if (item.type === 'OBD_FREEZE_FRAME_TRIGGER') {
    const trigger = item.metadata?.freezeFrameTrigger as { frameNumber?: number; triggerDtc?: string } | null | undefined;
    if (trigger) return `Frame ${trigger.frameNumber ?? '—'}${trigger.triggerDtc ? ` · trigger ${trigger.triggerDtc}` : ''} · full freeze-frame not claimed`;
    return item.metadata?.executionStatus === 'NO_DATA'
      ? 'No freeze-frame trigger was available in this capture.'
      : `Freeze-frame trigger service: ${item.metadata?.executionStatus ?? 'UNKNOWN'}`;
  }

  if (item.type === 'LIVE_OBD_TELEMETRY_WINDOW') {
    const signals = Array.isArray(item.metadata?.signalTypes) ? item.metadata?.signalTypes : [];
    return `${item.metadata?.captureContext ?? 'UNCLASSIFIED'} · ${signals.length} signals · ${item.metadata?.validEcuSampleCount ?? 0} valid ECU samples`;
  }

  return null;
}

export default function CheckEvaluationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const { context } = useLocalContext();
  const evaluationId = route.params?.evaluationId as string | undefined;
  const [check, setCheck] = useState<StoredAutoPulseCheck | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!db || !evaluationId) return;
    setLoading(true);
    setError(null);
    try {
      const repo = new CheckEvaluationRepository(db);
      const nextCheck = await repo.getEvaluation(createEvaluationId(evaluationId));
      if (!nextCheck) throw new Error('Evaluation not found.');
      const nextEvidence = await repo.listEvidence(evaluationId);
      setCheck(nextCheck);
      setEvidence(nextEvidence);

      if (context?.defaultWorkspaceId) {
        const vehicleRepo = new VehicleRepository(db);
        setVehicle(await vehicleRepo.getVehicle(context.defaultWorkspaceId, nextCheck.evaluation.vehicleId));
      }
    } catch (err) {
      console.error('[AutoPulseCheck] Failed to load evaluation:', err);
      setError(err instanceof Error ? err.message : 'Could not load evaluation.');
    } finally {
      setLoading(false);
    }
  }, [db, evaluationId, context?.defaultWorkspaceId]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const plan = useMemo(
    () => check ? buildAutoPulseCheckPlan(check.purpose, check.capabilities) : null,
    [check],
  );

  if (loading && !check) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#d9ff3f" />
        <Text style={styles.loadingText}>Loading evaluation…</Text>
      </View>
    );
  }

  if (!check || !plan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Check unavailable</Text>
        <Text style={styles.errorCopy}>{error ?? 'Evaluation could not be reconstructed.'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const evidenceMutable = canAddEvidence(check.evaluation.state).ok;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Evaluations</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AUTOPULSE CHECK</Text>
            <Text style={styles.title}>{vehicle?.alias ?? 'Vehicle evaluation'}</Text>
            <Text style={styles.meta}>{check.purpose.replace(/_/g, ' ')} · {check.evaluation.state.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.statePill}><Text style={styles.stateText}>{evidence.length} evidence</Text></View>
        </View>

        <View style={styles.boundaryCard}>
          <Text style={styles.boundaryTitle}>Evaluation boundary</Text>
          <Text style={styles.boundaryText}>
            Only completed evidence below may support findings. Unknown or unavailable systems remain outside the evaluated scope.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Review steps</Text>
        {plan.steps.map(step => {
          const status = statusForStep(step, evidence);
          const item = evidenceForStep(step, evidence);
          const executionStatus = item?.metadata?.executionStatus as string | undefined;
          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.orderBubble}><Text style={styles.orderText}>{String(step.order / 10).padStart(2, '0')}</Text></View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDetail}>
                  {executionStatus ? `Capture: ${executionStatus}` : step.limitation ?? (step.mandatory ? 'Required for this Check purpose.' : 'Optional evidence step.')}
                </Text>
              </View>
              <View style={[styles.statusPill, styles[`tone_${status.tone}`]]}>
                <Text style={[styles.statusText, styles[`toneText_${status.tone}`]]}>{status.label}</Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Evidence dossier</Text>
        {evidence.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No OBD or Live evidence has been committed to this evaluation yet.</Text>
          </View>
        ) : evidence.map(item => {
          const summary = evidenceSummary(item);
          return (
            <View key={item.id} style={styles.evidenceCard}>
              <View style={styles.evidenceHeader}>
                <Text style={styles.evidenceType}>{item.type.replace(/_/g, ' ')}</Text>
                <Text style={[styles.evidenceState, item.state === 'FAILED' && styles.evidenceStateFailed]}>{item.state}</Text>
              </View>
              <Text style={styles.evidenceOrigin}>{item.origin.replace(/_/g, ' ')}</Text>
              {summary ? <Text style={styles.evidenceSummary}>{summary}</Text> : null}
              {typeof item.metadata?.telemetryGapMs === 'number' && item.metadata.telemetryGapMs > 0 ? (
                <Text style={styles.gapText}>Telemetry gap: {item.metadata.telemetryGapMs} ms</Text>
              ) : null}
            </View>
          );
        })}

        <View style={styles.connectorCard}>
          <Text style={styles.connectorTitle}>Electronic evidence capture</Text>
          <Text style={styles.connectorText}>
            Connect a diagnostic adapter to run capability discovery, stored-DTC, PID 01 monitor-status and freeze-frame-trigger reads without creating a Live session or writing to the vehicle.
          </Text>
          <TouchableOpacity
            style={[styles.captureButton, !evidenceMutable && styles.captureButtonDisabled]}
            disabled={!evidenceMutable}
            onPress={() => navigation.navigate('CheckConnectObd', {
              evaluationId: check.evaluation.id,
              vehicleId: check.evaluation.vehicleId,
            })}
            activeOpacity={0.85}
          >
            <Text style={styles.captureButtonText}>{evidence.length > 0 ? 'Run another diagnostic capture' : 'Connect adapter and capture'}</Text>
          </TouchableOpacity>
          {!evidenceMutable ? <Text style={styles.lockedText}>This evaluation state no longer accepts new evidence.</Text> : null}
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Findings & professional review</Text>
          <Text style={styles.reviewText}>
            AutoPulse can propose evidence-backed findings, but only a professional review can confirm, reject or mark them inconclusive. No proposal is treated as a vehicle-health conclusion.
          </Text>
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => navigation.navigate('CheckFindings', { evaluationId: check.evaluation.id })}
            activeOpacity={0.85}
          >
            <Text style={styles.reviewButtonText}>Review findings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  centered: { flex: 1, backgroundColor: '#0b1114', alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  errorTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  errorCopy: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  backLink: { color: '#a3e635', marginTop: 18, fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  headerCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { color: '#84cc16', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#f8fafc', fontSize: 29, fontWeight: '700', marginTop: 5 },
  meta: { color: '#94a3b8', fontSize: 11, marginTop: 5, textTransform: 'capitalize' },
  statePill: { borderRadius: 999, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 10, paddingVertical: 7 },
  stateText: { color: '#cbd5e1', fontSize: 10, fontWeight: '800' },
  boundaryCard: { borderRadius: 15, borderWidth: 1, borderColor: '#3f4d25', backgroundColor: '#161d12', padding: 14, marginTop: 20 },
  boundaryTitle: { color: '#d9ff3f', fontSize: 12, fontWeight: '900' },
  boundaryText: { color: '#a6b29a', fontSize: 11, lineHeight: 17, marginTop: 5 },
  sectionTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '800', marginTop: 25, marginBottom: 8 },
  stepRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1f2a30', paddingVertical: 10 },
  orderBubble: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#172027', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  orderText: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  stepCopy: { flex: 1, paddingRight: 8 },
  stepTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  stepDetail: { color: '#718096', fontSize: 10, lineHeight: 15, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 8, fontWeight: '900' },
  tone_good: { backgroundColor: 'rgba(34,197,94,0.12)' },
  tone_warn: { backgroundColor: 'rgba(245,158,11,0.12)' },
  tone_bad: { backgroundColor: 'rgba(239,68,68,0.12)' },
  tone_muted: { backgroundColor: 'rgba(100,116,139,0.12)' },
  tone_pending: { backgroundColor: 'rgba(59,130,246,0.10)' },
  toneText_good: { color: '#4ade80' },
  toneText_warn: { color: '#f59e0b' },
  toneText_bad: { color: '#f87171' },
  toneText_muted: { color: '#64748b' },
  toneText_pending: { color: '#60a5fa' },
  emptyCard: { borderRadius: 14, backgroundColor: '#11181d', borderWidth: 1, borderColor: '#26343d', padding: 15 },
  emptyText: { color: '#7f8ea3', fontSize: 11, lineHeight: 17 },
  evidenceCard: { borderRadius: 14, backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a3740', padding: 13, marginBottom: 9 },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center' },
  evidenceType: { color: '#e2e8f0', flex: 1, fontSize: 11, fontWeight: '800' },
  evidenceState: { color: '#84cc16', fontSize: 9, fontWeight: '900' },
  evidenceStateFailed: { color: '#f87171' },
  evidenceOrigin: { color: '#64748b', fontSize: 9, marginTop: 6 },
  evidenceSummary: { color: '#aab7c7', fontSize: 10, lineHeight: 16, marginTop: 7 },
  gapText: { color: '#f59e0b', fontSize: 9, marginTop: 6 },
  connectorCard: { marginTop: 22, borderRadius: 16, backgroundColor: '#111a1f', borderWidth: 1, borderColor: '#334155', padding: 15 },
  connectorTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  connectorText: { color: '#8492a6', fontSize: 11, lineHeight: 17, marginTop: 6 },
  captureButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#d9ff3f', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  captureButtonDisabled: { opacity: 0.4 },
  captureButtonText: { color: '#172000', fontSize: 13, fontWeight: '900' },
  lockedText: { color: '#64748b', fontSize: 9, marginTop: 8, textAlign: 'center' },
  reviewCard: { marginTop: 14, borderRadius: 16, backgroundColor: '#121a20', borderWidth: 1, borderColor: '#365314', padding: 15 },
  reviewTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  reviewText: { color: '#8fa07f', fontSize: 11, lineHeight: 17, marginTop: 6 },
  reviewButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#84cc16', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  reviewButtonText: { color: '#bef264', fontSize: 13, fontWeight: '900' },
});
