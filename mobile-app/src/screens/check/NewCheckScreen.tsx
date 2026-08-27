import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AutoPulseCheckEngine } from '../../application/check/AutoPulseCheckEngine';
import {
  AutoPulseCheckCapabilityFacts,
  AutoPulseCheckPurpose,
} from '../../application/check/AutoPulseCheckPlan';
import { EvaluationState } from '../../domain/evaluation/models/enums';
import {
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../domain/shared/timestamps';
import { productCheckIdFactory } from '../../infrastructure/check/ProductCheckIdFactory';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { VehicleRepository } from '../../infrastructure/database/product/repositories/vehicle.repository';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';

const PURPOSES: Array<{ id: AutoPulseCheckPurpose; title: string; detail: string }> = [
  { id: 'PREVENTIVE', title: 'Preventive', detail: 'General condition review and baseline evidence.' },
  { id: 'PRE_PURCHASE', title: 'Pre-purchase', detail: 'Evidence-oriented review before buying a used vehicle.' },
  { id: 'PRE_TRIP', title: 'Pre-trip', detail: 'Focused review before a meaningful trip.' },
  { id: 'WORKSHOP', title: 'Workshop', detail: 'Structured evidence for a workshop inspection.' },
  { id: 'FLEET', title: 'Fleet', detail: 'Repeatable review for a managed vehicle.' },
  { id: 'CUSTOM', title: 'Custom', detail: 'Create the evidence file without assuming a standard purpose.' },
];

const UNKNOWN_CAPABILITIES: AutoPulseCheckCapabilityFacts = {
  obd: 'UNKNOWN',
  dtcRead: 'UNKNOWN',
  readiness: 'UNKNOWN',
  freezeFrame: 'UNKNOWN',
  liveTelemetry: 'UNKNOWN',
  availableSignals: [],
};

export default function NewCheckScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const { context } = useLocalContext();
  const vehicleId = route.params?.vehicleId as string | undefined;
  const [vehicle, setVehicle] = useState<any>(null);
  const [purpose, setPurpose] = useState<AutoPulseCheckPurpose>('PREVENTIVE');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !context?.defaultWorkspaceId || !vehicleId) return;
    const repo = new VehicleRepository(db);
    repo.getVehicle(context.defaultWorkspaceId, vehicleId)
      .then(setVehicle)
      .catch(err => {
        console.error('[AutoPulseCheck] Could not load vehicle:', err);
        setError('Vehicle profile could not be loaded.');
      });
  }, [db, context?.defaultWorkspaceId, vehicleId]);

  const purposeDetail = useMemo(
    () => PURPOSES.find(item => item.id === purpose)?.detail ?? '',
    [purpose],
  );

  const createEvaluation = async () => {
    if (!db || !context?.defaultWorkspaceId || !context?.defaultOperatorId || !vehicleId || creating) return;
    setCreating(true);
    setError(null);

    try {
      const store = new CheckEvaluationRepository(db);
      const engine = new AutoPulseCheckEngine(
        store,
        productCheckIdFactory,
        () => parseUtcIsoTimestamp(new Date().toISOString()),
      );
      const created = await engine.createDraft({
        tenantId: createTenantId(context.defaultWorkspaceId),
        vehicleId: createVehicleId(vehicleId),
        technicianId: createTechnicianId(context.defaultOperatorId),
        purpose,
        capabilities: UNKNOWN_CAPABILITIES,
      });

      const opened = await engine.transition(created.evaluation.id, EvaluationState.OPEN);
      if (opened.ok === false) throw new Error(opened.error.message);
      const collecting = await engine.transition(created.evaluation.id, EvaluationState.EVIDENCE_COLLECTION);
      if (collecting.ok === false) throw new Error(collecting.error.message);

      navigation.replace('CheckEvaluation', { evaluationId: created.evaluation.id });
    } catch (err) {
      console.error('[AutoPulseCheck] Failed to create evaluation:', err);
      setError(err instanceof Error ? err.message : 'Could not create the evaluation.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Check</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>NEW EVALUATION</Text>
        <Text style={styles.title}>{vehicle?.alias ?? 'Vehicle'}</Text>
        <Text style={styles.vehicleMeta}>
          {vehicle ? [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') : 'Loading vehicle profile…'}
        </Text>

        <Text style={styles.sectionLabel}>WHY ARE YOU CHECKING THIS VEHICLE?</Text>
        <View style={styles.purposeGrid}>
          {PURPOSES.map(item => {
            const selected = item.id === purpose;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.purposeCard, selected && styles.purposeCardSelected]}
                onPress={() => setPurpose(item.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.purposeTitle, selected && styles.purposeTitleSelected]}>{item.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.explainCard}>
          <Text style={styles.explainTitle}>{PURPOSES.find(item => item.id === purpose)?.title}</Text>
          <Text style={styles.explainText}>{purposeDetail}</Text>
          <Text style={styles.explainFootnote}>
            Electronic coverage begins UNKNOWN. AutoPulse will promote only capabilities that are actually observed during this evaluation.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, creating && styles.primaryButtonDisabled]}
          disabled={creating || !vehicle || !db || !context}
          onPress={createEvaluation}
          activeOpacity={0.85}
        >
          {creating ? <ActivityIndicator color="#152000" /> : <Text style={styles.primaryButtonText}>Create evaluation</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  eyebrow: { color: '#84cc16', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 10 },
  title: { color: '#f8fafc', fontSize: 32, fontWeight: '700', marginTop: 6 },
  vehicleMeta: { color: '#94a3b8', fontSize: 14, marginTop: 5 },
  sectionLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 30, marginBottom: 10 },
  purposeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  purposeCard: { width: '48%', minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#334155', backgroundColor: '#121b20', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  purposeCardSelected: { backgroundColor: '#d9ff3f', borderColor: '#d9ff3f' },
  purposeTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  purposeTitleSelected: { color: '#182108' },
  explainCard: { marginTop: 20, borderRadius: 16, backgroundColor: '#111a1f', borderWidth: 1, borderColor: '#2a3942', padding: 16 },
  explainTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  explainText: { color: '#a8b4c4', fontSize: 13, lineHeight: 19, marginTop: 6 },
  explainFootnote: { color: '#64748b', fontSize: 11, lineHeight: 17, marginTop: 12 },
  errorText: { color: '#f87171', fontSize: 12, lineHeight: 18, marginTop: 16 },
  primaryButton: { minHeight: 58, borderRadius: 16, backgroundColor: '#d9ff3f', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: '#172000', fontSize: 16, fontWeight: '900' },
});
