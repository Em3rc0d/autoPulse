import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CheckReportFinalizationEngine } from '../../application/check/CheckReportFinalization';
import { createEvaluationId } from '../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../domain/shared/timestamps';
import { expoReportIntegrityHasher } from '../../infrastructure/check/ExpoReportIntegrityHasher';
import { productCheckReportIds } from '../../infrastructure/check/ProductCheckReportIdFactory';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { CheckFindingRepository } from '../../infrastructure/database/product/repositories/check-finding.repository';
import { CheckReportRepository } from '../../infrastructure/database/product/repositories/check-report.repository';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import CheckReportScreen from './CheckReportScreen';

/**
 * Route-level recovery gate for the narrow process-death window between
 * durable ReportVersion creation and the final Evaluation SIGNED state write.
 * A mismatch is surfaced; the report UI is never allowed to regenerate over it.
 */
export default function CheckReportRecoveryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const evaluationIdParam = route.params?.evaluationId as string | undefined;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      if (!db || !evaluationIdParam) return;
      setReady(false);
      setError(null);
      try {
        const evaluationRepo = new CheckEvaluationRepository(db);
        const findingRepo = new CheckFindingRepository(db);
        const reportRepo = new CheckReportRepository(db);
        const engine = new CheckReportFinalizationEngine(
          evaluationRepo,
          findingRepo,
          reportRepo,
          productCheckReportIds,
          expoReportIntegrityHasher,
          () => parseUtcIsoTimestamp(new Date().toISOString()),
        );
        const result = await engine.reconcileInterruptedSignature(createEvaluationId(evaluationIdParam));
        if (result.ok === false) throw new Error(result.error.message);
        if (!cancelled) setReady(true);
      } catch (recoveryError) {
        console.error('[AutoPulseCheck] Report recovery gate blocked:', recoveryError);
        if (!cancelled) {
          setError(recoveryError instanceof Error ? recoveryError.message : 'Report recovery failed.');
        }
      }
    };

    void reconcile();
    return () => {
      cancelled = true;
    };
  }, [db, evaluationIdParam]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>REPORT INTEGRITY</Text>
        <Text style={styles.title}>Recovery blocked</Text>
        <Text style={styles.copy}>{error}</Text>
        <Text style={styles.warning}>
          AutoPulse will not create another report version or overwrite the stored snapshot while this inconsistency exists.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Return to evaluation</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#d9ff3f" />
        <Text style={styles.loading}>Verifying report state…</Text>
      </View>
    );
  }

  return <CheckReportScreen />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114', alignItems: 'center', justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#f59e0b', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900', marginTop: 7 },
  copy: { color: '#cbd5e1', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  warning: { color: '#fca5a5', fontSize: 10, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  button: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#475569', paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  buttonText: { color: '#e2e8f0', fontSize: 12, fontWeight: '900' },
  loading: { color: '#94a3b8', fontSize: 11, marginTop: 10 },
});
