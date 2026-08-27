import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { assessCheckCoverage } from '../../application/check/CheckCoverageAssessment';
import {
  CheckReportFinalizationEngine,
  SignedCheckReport,
} from '../../application/check/CheckReportFinalization';
import { StoredAutoPulseCheck } from '../../application/check/AutoPulseCheckEngine';
import {
  CoverageLevel,
  EvidenceState,
  EvaluationState,
  FindingStatus,
} from '../../domain/evaluation/models/enums';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { Finding } from '../../domain/evaluation/models/finding';
import { createEvaluationId } from '../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../domain/shared/timestamps';
import { expoReportIntegrityHasher } from '../../infrastructure/check/ExpoReportIntegrityHasher';
import { productCheckReportIds } from '../../infrastructure/check/ProductCheckReportIdFactory';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { CheckFindingRepository } from '../../infrastructure/database/product/repositories/check-finding.repository';
import { CheckReportRepository } from '../../infrastructure/database/product/repositories/check-report.repository';
import { VehicleRepository } from '../../infrastructure/database/product/repositories/vehicle.repository';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';

function coverageColor(level: CoverageLevel) {
  if (level === CoverageLevel.HIGH) return '#4ade80';
  if (level === CoverageLevel.PARTIAL) return '#f59e0b';
  return '#f87171';
}

export default function CheckReportScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const { context } = useLocalContext();
  const evaluationIdParam = route.params?.evaluationId as string | undefined;

  const [check, setCheck] = useState<StoredAutoPulseCheck | null>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [signed, setSigned] = useState<SignedCheckReport | null>(null);
  const [coverage, setCoverage] = useState<any>(null);
  const [recommendations, setRecommendations] = useState('');
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeEngine = useCallback(() => {
    if (!db) return null;
    const evaluationRepo = new CheckEvaluationRepository(db);
    const findingRepo = new CheckFindingRepository(db);
    const reportRepo = new CheckReportRepository(db);
    return new CheckReportFinalizationEngine(
      evaluationRepo,
      findingRepo,
      reportRepo,
      productCheckReportIds,
      expoReportIntegrityHasher,
      () => parseUtcIsoTimestamp(new Date().toISOString()),
    );
  }, [db]);

  const load = useCallback(async () => {
    if (!db || !context?.defaultWorkspaceId || !evaluationIdParam) return;
    setLoading(true);
    setError(null);
    try {
      const evaluationId = createEvaluationId(evaluationIdParam);
      const evaluationRepo = new CheckEvaluationRepository(db);
      const findingRepo = new CheckFindingRepository(db);
      const vehicleRepo = new VehicleRepository(db);
      const current = await evaluationRepo.getEvaluation(evaluationId);
      if (!current) throw new Error('Evaluation not found.');
      const currentEvidence = await evaluationRepo.listEvidence(evaluationIdParam);
      const currentFindings = await findingRepo.listFindings(evaluationIdParam);
      const currentVehicle = await vehicleRepo.getVehicle(context.defaultWorkspaceId, current.evaluation.vehicleId);

      setCheck(current);
      setEvidence(currentEvidence);
      setFindings(currentFindings);
      setVehicle(currentVehicle);
      setCoverage(
        current.evaluation.coverage
        ?? assessCheckCoverage(current, currentEvidence, new Date().toISOString()).coverage,
      );

      if (current.evaluation.state === EvaluationState.SIGNED || current.evaluation.state === EvaluationState.DELIVERED) {
        const engine = makeEngine();
        if (!engine) throw new Error('Report engine unavailable.');
        const verified = await engine.verifyStoredVersion(evaluationId);
        if (verified.ok === false) throw new Error(verified.error.message);
        setSigned(verified.value);
        setCoverage(verified.value.manifest.coverage ?? current.evaluation.coverage);
        setRecommendations(verified.value.manifest.recommendations ?? '');
      } else {
        setSigned(null);
      }
    } catch (loadError) {
      console.error('[AutoPulseCheck] Failed to load report preparation:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load report preparation.');
    } finally {
      setLoading(false);
    }
  }, [context?.defaultWorkspaceId, db, evaluationIdParam, makeEngine]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const signReport = async () => {
    if (!evaluationIdParam || !vehicle || signing) return;
    const engine = makeEngine();
    if (!engine) return;
    setSigning(true);
    setError(null);
    try {
      const result = await engine.sign({
        evaluationId: createEvaluationId(evaluationIdParam),
        vehicleSnapshot: {
          vin: vehicle.vin ?? undefined,
          make: vehicle.make ?? undefined,
          model: vehicle.model ?? undefined,
          year: vehicle.year ?? undefined,
        },
        recommendations: recommendations.trim() || undefined,
      });
      if (result.ok === false) throw new Error(result.error.message);
      setSigned(result.value);
      setCheck(result.value.evaluation);
      setCoverage(result.value.manifest.coverage);
    } catch (signError) {
      console.error('[AutoPulseCheck] Report signing failed:', signError);
      setError(signError instanceof Error ? signError.message : 'Report signing failed.');
    } finally {
      setSigning(false);
    }
  };

  if (loading && !check) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#d9ff3f" />
        <Text style={styles.loadingText}>Preparing report evidence…</Text>
      </View>
    );
  }

  if (!check) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Report unavailable</Text>
        <Text style={styles.errorCopy}>{error ?? 'Evaluation could not be reconstructed.'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const proposed = findings.filter(item => item.status === FindingStatus.PROPOSED).length;
  const committed = evidence.filter(item => item.state === EvidenceState.COMMITTED).length;
  const canSign = !signed
    && proposed === 0
    && committed > 0
    && (check.evaluation.state === EvaluationState.IN_REVIEW || check.evaluation.state === EvaluationState.READY_FOR_SIGNATURE);
  const integrityOk = signed?.integrityVerified ?? false;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Findings</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>{signed ? 'SIGNED SNAPSHOT' : 'REPORT PREPARATION'}</Text>
        <Text style={styles.title}>{vehicle?.alias ?? 'AutoPulse Check'}</Text>
        <Text style={styles.subtitle}>{check.purpose.replace(/_/g, ' ')} · {check.evaluation.state.replace(/_/g, ' ')}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: coverageColor(coverage?.overallLevel ?? CoverageLevel.LIMITED) }]}>{coverage?.overallLevel ?? '—'}</Text>
            <Text style={styles.metricLabel}>COVERAGE</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{committed}</Text>
            <Text style={styles.metricLabel}>COMMITTED EVIDENCE</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{findings.length}</Text>
            <Text style={styles.metricLabel}>FINDINGS</Text>
          </View>
        </View>

        <View style={styles.truthCard}>
          <Text style={styles.truthTitle}>Scope truth</Text>
          <Text style={styles.truthText}>
            Signing freezes the evidence, findings, coverage and limitations into an immutable report version. PARTIAL or LIMITED coverage remains explicit; AutoPulse does not upgrade it to a complete vehicle inspection.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Coverage</Text>
        {(coverage?.assessedItems ?? []).map((item: any) => (
          <View key={item.moduleName} style={styles.coverageRow}>
            <Text style={styles.coverageIcon}>{item.isCovered ? '✓' : '–'}</Text>
            <View style={styles.coverageCopy}>
              <Text style={styles.coverageTitle}>{item.moduleName}</Text>
              {!item.isCovered && item.reasonIfNotCovered ? <Text style={styles.coverageReason}>{item.reasonIfNotCovered}</Text> : null}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Documented limitations</Text>
        <View style={styles.limitCard}>
          <Text style={styles.limitText}>{signed?.manifest.limitations ?? check.evaluation.limitations ?? 'Limitations will be calculated from the final evidence set at signature time.'}</Text>
        </View>

        {!signed ? (
          <>
            <Text style={styles.sectionTitle}>Professional recommendation</Text>
            <TextInput
              style={styles.recommendationInput}
              value={recommendations}
              onChangeText={setRecommendations}
              placeholder="Optional recommendation to include in the signed report"
              placeholderTextColor="#596879"
              multiline
              textAlignVertical="top"
            />

            {proposed > 0 ? <Text style={styles.blockerText}>{proposed} proposed finding(s) still require professional review.</Text> : null}
            {committed === 0 ? <Text style={styles.blockerText}>At least one committed evidence item is required before signing.</Text> : null}
            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.signButton, !canSign && styles.signButtonDisabled]}
              disabled={!canSign || signing}
              onPress={signReport}
              activeOpacity={0.85}
            >
              {signing ? <ActivityIndicator color="#172000" /> : <Text style={styles.signButtonText}>Sign immutable report snapshot</Text>}
            </TouchableOpacity>
            <Text style={styles.signatureBoundary}>
              This records the current operator as reviewer/signatory and stores a SHA-256 integrity fingerprint. It is not a PKI-qualified or statutory digital signature.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Integrity receipt</Text>
            <View style={[styles.integrityCard, integrityOk ? styles.integrityGood : styles.integrityBad]}>
              <Text style={[styles.integrityStatus, { color: integrityOk ? '#4ade80' : '#f87171' }]}>{integrityOk ? '✓ INTEGRITY VERIFIED' : '✕ INTEGRITY FAILED'}</Text>
              <Text style={styles.integrityMeta}>Report version {signed.version.versionNumber} · {signed.version.state}</Text>
              <Text style={styles.integrityMeta}>Signed {new Date(signed.version.signedAt).toLocaleString()}</Text>
              <Text selectable style={styles.hashText}>{signed.version.integrityHash}</Text>
            </View>

            <Text style={styles.sectionTitle}>Frozen contents</Text>
            <View style={styles.frozenCard}>
              <Text style={styles.frozenLine}>{signed.manifest.selectedEvidence.length} evidence item(s)</Text>
              <Text style={styles.frozenLine}>{signed.manifest.findings.length} finding(s)</Text>
              <Text style={styles.frozenLine}>Engine {signed.manifest.engineVersion}</Text>
              <Text style={styles.frozenLine}>Catalog {signed.manifest.catalogVersion}</Text>
              {signed.manifest.vehicleSnapshot.protocolDetected ? <Text style={styles.frozenLine}>Protocol {signed.manifest.vehicleSnapshot.protocolDetected}</Text> : null}
            </View>
            {!integrityOk ? (
              <View style={styles.integrityWarning}>
                <Text style={styles.integrityWarningTitle}>Do not trust this report version</Text>
                <Text style={styles.integrityWarningText}>The stored canonical payload no longer matches its signed fingerprint. AutoPulse will not silently regenerate or overwrite the signed evidence.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  centered: { flex: 1, backgroundColor: '#0b1114', alignItems: 'center', justifyContent: 'center', padding: 28 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 42 },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  errorTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  errorCopy: { color: '#94a3b8', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  backLink: { color: '#a3e635', fontWeight: '700', marginTop: 18 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  eyebrow: { color: '#84cc16', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 8 },
  title: { color: '#f8fafc', fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 5, textTransform: 'capitalize' },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  metricCard: { flex: 1, minHeight: 78, borderRadius: 13, borderWidth: 1, borderColor: '#283640', backgroundColor: '#11191e', padding: 10, justifyContent: 'space-between' },
  metricValue: { color: '#f8fafc', fontSize: 16, fontWeight: '900' },
  metricLabel: { color: '#64748b', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  truthCard: { borderRadius: 15, borderWidth: 1, borderColor: '#3f4d25', backgroundColor: '#161d12', padding: 14, marginTop: 16 },
  truthTitle: { color: '#d9ff3f', fontSize: 12, fontWeight: '900' },
  truthText: { color: '#a6b29a', fontSize: 11, lineHeight: 17, marginTop: 5 },
  sectionTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '800', marginTop: 23, marginBottom: 8 },
  coverageRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#1d2930' },
  coverageIcon: { width: 24, color: '#84cc16', fontWeight: '900' },
  coverageCopy: { flex: 1 },
  coverageTitle: { color: '#d7e0e8', fontSize: 11, fontWeight: '700' },
  coverageReason: { color: '#9a7c50', fontSize: 9, lineHeight: 14, marginTop: 3 },
  limitCard: { borderRadius: 13, backgroundColor: '#11191e', borderWidth: 1, borderColor: '#2a3740', padding: 13 },
  limitText: { color: '#aab7c7', fontSize: 10, lineHeight: 16 },
  recommendationInput: { minHeight: 92, borderRadius: 13, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0d1519', color: '#e2e8f0', padding: 12, fontSize: 11, lineHeight: 17 },
  blockerText: { color: '#f59e0b', fontSize: 10, lineHeight: 16, marginTop: 10 },
  errorInline: { color: '#f87171', fontSize: 10, lineHeight: 16, marginTop: 10 },
  signButton: { minHeight: 58, borderRadius: 15, backgroundColor: '#d9ff3f', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  signButtonDisabled: { opacity: 0.38 },
  signButtonText: { color: '#172000', fontSize: 13, fontWeight: '900' },
  signatureBoundary: { color: '#64748b', fontSize: 9, lineHeight: 15, marginTop: 9, textAlign: 'center' },
  integrityCard: { borderRadius: 16, borderWidth: 1, padding: 15 },
  integrityGood: { borderColor: '#235b37', backgroundColor: '#0f1b15' },
  integrityBad: { borderColor: '#7f1d1d', backgroundColor: '#211114' },
  integrityStatus: { fontSize: 12, fontWeight: '900' },
  integrityMeta: { color: '#9fb1a7', fontSize: 10, marginTop: 6 },
  hashText: { color: '#cbd5e1', fontSize: 9, lineHeight: 14, marginTop: 12, fontFamily: 'monospace' },
  frozenCard: { borderRadius: 13, borderWidth: 1, borderColor: '#2a3740', backgroundColor: '#11191e', padding: 13 },
  frozenLine: { color: '#aab7c7', fontSize: 10, lineHeight: 17 },
  integrityWarning: { borderRadius: 13, borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: '#211114', padding: 13, marginTop: 15 },
  integrityWarningTitle: { color: '#f87171', fontSize: 11, fontWeight: '900' },
  integrityWarningText: { color: '#c99aa1', fontSize: 10, lineHeight: 16, marginTop: 5 },
});
