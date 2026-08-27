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
import { AutoPulseCheckEngine, StoredAutoPulseCheck } from '../../application/check/AutoPulseCheckEngine';
import { CheckFindingEngine } from '../../application/check/CheckFindingEngine';
import {
  ConfidenceLevel,
  EvaluationState,
  FindingSeverity,
  FindingSource,
  FindingStatus,
} from '../../domain/evaluation/models/enums';
import { Finding } from '../../domain/evaluation/models/finding';
import {
  createEvaluationId,
  createFindingId,
  createTechnicianId,
} from '../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../domain/shared/timestamps';
import { productCheckFindingIdFactory } from '../../infrastructure/check/ProductCheckFindingIdFactory';
import { productCheckIdFactory } from '../../infrastructure/check/ProductCheckIdFactory';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { CheckFindingRepository } from '../../infrastructure/database/product/repositories/check-finding.repository';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';

function sourceLabel(source: FindingSource) {
  if (source === FindingSource.SYSTEM_RULE) return 'SYSTEM PROPOSAL';
  if (source === FindingSource.HYBRID) return 'SYSTEM + PROFESSIONAL';
  return 'PROFESSIONAL';
}

function severityLabel(severity: FindingSeverity) {
  return severity.replace(/_/g, ' ');
}

function statusLabel(status: FindingStatus) {
  return status.replace(/_/g, ' ');
}

export default function CheckFindingsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const { context } = useLocalContext();
  const evaluationIdParam = route.params?.evaluationId as string | undefined;

  const [check, setCheck] = useState<StoredAutoPulseCheck | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!db || !context?.defaultOperatorId || !evaluationIdParam) return;
    setLoading(true);
    setError(null);

    const evaluationId = createEvaluationId(evaluationIdParam);
    const evaluationRepo = new CheckEvaluationRepository(db);
    const findingRepo = new CheckFindingRepository(db);
    const checkEngine = new AutoPulseCheckEngine(
      evaluationRepo,
      productCheckIdFactory,
      () => parseUtcIsoTimestamp(new Date().toISOString()),
    );

    try {
      let current = await evaluationRepo.getEvaluation(evaluationId);
      if (!current) throw new Error('Evaluation not found.');

      // Enter professional review only from the evidence/review queue states.
      // Merely opening this screen never rolls a signed/ready evaluation backward.
      if (current.evaluation.state === EvaluationState.EVIDENCE_COLLECTION) {
        const pending = await checkEngine.transition(evaluationId, EvaluationState.REVIEW_PENDING);
        if (pending.ok === false) throw new Error(pending.error.message);
        current = await evaluationRepo.getEvaluation(evaluationId);
      }
      if (current?.evaluation.state === EvaluationState.REVIEW_PENDING) {
        const inReview = await checkEngine.transition(evaluationId, EvaluationState.IN_REVIEW);
        if (inReview.ok === false) throw new Error(inReview.error.message);
        current = await evaluationRepo.getEvaluation(evaluationId);
      }
      if (!current) throw new Error('Evaluation could not be reconstructed after review transition.');

      const findingEngine = new CheckFindingEngine(
        evaluationRepo,
        evaluationRepo,
        findingRepo,
        productCheckFindingIdFactory,
        () => parseUtcIsoTimestamp(new Date().toISOString()),
      );
      const generated = await findingEngine.generateSystemProposals(evaluationId);
      if (generated.ok === false && current.evaluation.state === EvaluationState.IN_REVIEW) {
        throw new Error(generated.error.message);
      }

      setCheck(await evaluationRepo.getEvaluation(evaluationId));
      setFindings(await findingRepo.listFindings(evaluationId));
    } catch (loadError) {
      console.error('[AutoPulseCheck] Failed to load findings review:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load findings review.');
    } finally {
      setLoading(false);
    }
  }, [context?.defaultOperatorId, db, evaluationIdParam]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const review = async (finding: Finding, finalStatus: FindingStatus) => {
    if (!db || !context?.defaultOperatorId || !evaluationIdParam || reviewingId) return;
    setReviewingId(finding.id);
    setError(null);
    try {
      const evaluationRepo = new CheckEvaluationRepository(db);
      const findingRepo = new CheckFindingRepository(db);
      const engine = new CheckFindingEngine(
        evaluationRepo,
        evaluationRepo,
        findingRepo,
        productCheckFindingIdFactory,
        () => parseUtcIsoTimestamp(new Date().toISOString()),
      );
      const note = notes[finding.id]?.trim();
      const result = await engine.reviewFinding({
        evaluationId: createEvaluationId(evaluationIdParam),
        findingId: createFindingId(finding.id),
        technicianId: createTechnicianId(context.defaultOperatorId),
        finalStatus: finalStatus as Exclude<FindingStatus, FindingStatus.PROPOSED>,
        finalSeverity: finding.severity,
        finalConfidence: finding.confidence,
        comment: note || undefined,
        justification: note || undefined,
      });
      if (result.ok === false) throw new Error(result.error.message);
      setFindings(await findingRepo.listFindings(evaluationIdParam));
    } catch (reviewError) {
      console.error('[AutoPulseCheck] Professional finding review failed:', reviewError);
      setError(reviewError instanceof Error ? reviewError.message : 'Finding review failed.');
    } finally {
      setReviewingId(null);
    }
  };

  if (loading && !check) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#d9ff3f" />
        <Text style={styles.loadingText}>Preparing evidence review…</Text>
      </View>
    );
  }

  if (!check) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Review unavailable</Text>
        <Text style={styles.errorCopy}>{error ?? 'Evaluation could not be loaded.'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const canReview = check.evaluation.state === EvaluationState.IN_REVIEW;
  const proposedCount = findings.filter(item => item.status === FindingStatus.PROPOSED).length;
  const reviewedCount = findings.length - proposedCount;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Evaluation</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>PROFESSIONAL REVIEW</Text>
        <Text style={styles.title}>Findings</Text>
        <Text style={styles.subtitle}>{check.purpose.replace(/_/g, ' ')} · {check.evaluation.state.replace(/_/g, ' ')}</Text>

        <View style={styles.authorityCard}>
          <Text style={styles.authorityTitle}>Authority boundary</Text>
          <Text style={styles.authorityText}>
            AutoPulse may propose deterministic findings from cited evidence. A proposal is not a professional conclusion until it is reviewed here by the operator.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{proposedCount}</Text>
            <Text style={styles.summaryLabel}>TO REVIEW</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{reviewedCount}</Text>
            <Text style={styles.summaryLabel}>REVIEWED</Text>
          </View>
        </View>

        {findings.length === 0 ? (
          <View style={styles.noFindingCard}>
            <Text style={styles.noFindingTitle}>No rule-backed finding proposed</Text>
            <Text style={styles.noFindingText}>
              The current evidence did not trigger the deterministic Check rules. This is not a statement that the vehicle is healthy, fault-free or fully assessed.
            </Text>
          </View>
        ) : null}

        {findings.map(finding => {
          const proposed = finding.status === FindingStatus.PROPOSED;
          const busy = reviewingId === finding.id;
          return (
            <View key={finding.id} style={styles.findingCard}>
              <View style={styles.findingHeader}>
                <View style={styles.findingHeaderCopy}>
                  <Text style={styles.sourceLabel}>{sourceLabel(finding.source)}</Text>
                  <Text style={styles.findingTitle}>{finding.clientExplanation ?? finding.technicalExplanation ?? 'Evidence-backed finding'}</Text>
                </View>
                <View style={[styles.statusPill, proposed ? styles.statusProposed : styles.statusReviewed]}>
                  <Text style={[styles.statusText, proposed ? styles.statusTextProposed : styles.statusTextReviewed]}>{statusLabel(finding.status)}</Text>
                </View>
              </View>

              <View style={styles.factRow}>
                <Text style={styles.factText}>Severity · {severityLabel(finding.severity)}</Text>
                <Text style={styles.factText}>Confidence · {finding.confidence}</Text>
              </View>

              {finding.technicalExplanation ? <Text style={styles.technicalText}>{finding.technicalExplanation}</Text> : null}
              {finding.suggestedAction ? (
                <View style={styles.actionBox}>
                  <Text style={styles.actionLabel}>SUGGESTED NEXT ACTION</Text>
                  <Text style={styles.actionText}>{finding.suggestedAction}</Text>
                </View>
              ) : null}
              {finding.limitations ? <Text style={styles.limitationText}>Limit: {finding.limitations}</Text> : null}
              <Text style={styles.evidenceText}>{finding.evidenceIds.length} cited evidence item{finding.evidenceIds.length === 1 ? '' : 's'}</Text>

              {finding.professionalReview ? (
                <View style={styles.reviewedBox}>
                  <Text style={styles.reviewedLabel}>PROFESSIONAL REVIEW</Text>
                  <Text style={styles.reviewedText}>{statusLabel(finding.professionalReview.finalStatus)} · {finding.professionalReview.finalConfidence}</Text>
                  {finding.professionalReview.comment ? <Text style={styles.reviewedComment}>{finding.professionalReview.comment}</Text> : null}
                </View>
              ) : null}

              {proposed && canReview ? (
                <>
                  <TextInput
                    style={styles.noteInput}
                    value={notes[finding.id] ?? ''}
                    onChangeText={value => setNotes(current => ({ ...current, [finding.id]: value }))}
                    placeholder="Professional note or justification (optional)"
                    placeholderTextColor="#596879"
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.reviewActions}>
                    <TouchableOpacity
                      style={[styles.reviewButton, styles.confirmButton]}
                      disabled={Boolean(reviewingId)}
                      onPress={() => review(finding, FindingStatus.CONFIRMED)}
                    >
                      <Text style={styles.confirmText}>{busy ? 'Saving…' : 'Confirm'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reviewButton, styles.inconclusiveButton]}
                      disabled={Boolean(reviewingId)}
                      onPress={() => review(finding, FindingStatus.INCONCLUSIVE)}
                    >
                      <Text style={styles.inconclusiveText}>Inconclusive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reviewButton, styles.rejectButton]}
                      disabled={Boolean(reviewingId)}
                      onPress={() => review(finding, FindingStatus.REJECTED)}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          );
        })}

        {error ? <Text style={styles.errorInline}>{error}</Text> : null}

        {!canReview ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Review controls locked</Text>
            <Text style={styles.lockedText}>The evaluation is {check.evaluation.state.replace(/_/g, ' ')}. Existing reviews remain visible, but this screen will not silently move a finalized evaluation backward.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  centered: { flex: 1, backgroundColor: '#0b1114', alignItems: 'center', justifyContent: 'center', padding: 28 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  errorTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  errorCopy: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  backLink: { color: '#a3e635', marginTop: 18, fontWeight: '700' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 18 },
  backText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  eyebrow: { color: '#84cc16', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 8 },
  title: { color: '#f8fafc', fontSize: 31, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 5, textTransform: 'capitalize' },
  authorityCard: { marginTop: 18, borderRadius: 15, borderWidth: 1, borderColor: '#3f4d25', backgroundColor: '#161d12', padding: 14 },
  authorityTitle: { color: '#d9ff3f', fontSize: 12, fontWeight: '900' },
  authorityText: { color: '#a6b29a', fontSize: 11, lineHeight: 17, marginTop: 5 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  summaryCard: { flex: 1, borderRadius: 14, backgroundColor: '#11191e', borderWidth: 1, borderColor: '#26343d', padding: 13 },
  summaryValue: { color: '#f8fafc', fontSize: 23, fontWeight: '900' },
  summaryLabel: { color: '#64748b', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  noFindingCard: { borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#11191e', padding: 16, marginTop: 18 },
  noFindingTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '800' },
  noFindingText: { color: '#8492a6', fontSize: 11, lineHeight: 18, marginTop: 6 },
  findingCard: { borderRadius: 16, borderWidth: 1, borderColor: '#2a3740', backgroundColor: '#121b20', padding: 15, marginTop: 14 },
  findingHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  findingHeaderCopy: { flex: 1, paddingRight: 8 },
  sourceLabel: { color: '#84cc16', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  findingTitle: { color: '#f1f5f9', fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: 5 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusProposed: { backgroundColor: 'rgba(245,158,11,0.12)' },
  statusReviewed: { backgroundColor: 'rgba(34,197,94,0.12)' },
  statusText: { fontSize: 8, fontWeight: '900' },
  statusTextProposed: { color: '#f59e0b' },
  statusTextReviewed: { color: '#4ade80' },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  factText: { color: '#94a3b8', fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  technicalText: { color: '#aab7c7', fontSize: 11, lineHeight: 17, marginTop: 10 },
  actionBox: { borderRadius: 12, backgroundColor: '#0e1519', padding: 11, marginTop: 10 },
  actionLabel: { color: '#64748b', fontSize: 8, fontWeight: '900', letterSpacing: 1.0 },
  actionText: { color: '#cbd5e1', fontSize: 10, lineHeight: 16, marginTop: 4 },
  limitationText: { color: '#f59e0b', fontSize: 9, lineHeight: 15, marginTop: 9 },
  evidenceText: { color: '#64748b', fontSize: 9, marginTop: 8 },
  reviewedBox: { borderRadius: 12, borderWidth: 1, borderColor: '#235b37', backgroundColor: '#0f1b15', padding: 11, marginTop: 11 },
  reviewedLabel: { color: '#4ade80', fontSize: 8, fontWeight: '900', letterSpacing: 1.0 },
  reviewedText: { color: '#d1fae5', fontSize: 10, fontWeight: '700', marginTop: 4 },
  reviewedComment: { color: '#8fb6a0', fontSize: 10, lineHeight: 16, marginTop: 5 },
  noteInput: { minHeight: 76, borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#e2e8f0', backgroundColor: '#0d1519', padding: 11, fontSize: 11, lineHeight: 16, marginTop: 12 },
  reviewActions: { flexDirection: 'row', gap: 7, marginTop: 10 },
  reviewButton: { flex: 1, minHeight: 43, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  confirmButton: { backgroundColor: '#d9ff3f' },
  inconclusiveButton: { backgroundColor: '#272f36', borderWidth: 1, borderColor: '#475569' },
  rejectButton: { backgroundColor: '#281417', borderWidth: 1, borderColor: '#7f1d1d' },
  confirmText: { color: '#172000', fontSize: 10, fontWeight: '900' },
  inconclusiveText: { color: '#cbd5e1', fontSize: 9, fontWeight: '900' },
  rejectText: { color: '#fca5a5', fontSize: 10, fontWeight: '900' },
  errorInline: { color: '#f87171', fontSize: 10, lineHeight: 16, marginTop: 14 },
  lockedCard: { borderRadius: 14, borderWidth: 1, borderColor: '#334155', backgroundColor: '#11191e', padding: 13, marginTop: 18 },
  lockedTitle: { color: '#cbd5e1', fontSize: 11, fontWeight: '800' },
  lockedText: { color: '#64748b', fontSize: 10, lineHeight: 16, marginTop: 5 },
});
