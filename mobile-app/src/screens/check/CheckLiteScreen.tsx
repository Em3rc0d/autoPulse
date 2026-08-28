import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useSessionSummary } from '../../infrastructure/hooks/useSessionSummary';
import {
  buildCheckLiteAssessment,
  RequestedCheckSignal,
} from '../../application/check/CheckLiteAssessmentBuilder';

const V1_CHECK_SCOPE: readonly RequestedCheckSignal[] = [
  { signalId: 'ENGINE_RPM', description: 'Engine RPM', isMandatory: true, origin: 'ECU' },
  { signalId: 'ENGINE_COOLANT', description: 'Engine coolant temperature', isMandatory: true, origin: 'ECU' },
  { signalId: 'VEHICLE_SPEED', description: 'Vehicle speed', isMandatory: true, origin: 'ECU' },
  { signalId: 'CONTROL_VOLTAGE', description: 'ECU control-module voltage', isMandatory: false, origin: 'ECU' },
];

function observationLabel(state: string) {
  switch (state) {
    case 'OBSERVED': return 'OBSERVED';
    case 'NO_DATA': return 'NO DATA';
    case 'INVALID_ONLY': return 'INVALID';
    default: return 'NOT EVALUATED';
  }
}

export default function CheckLiteScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { sessionId, vehicleId } = route.params || {};
  const { context } = useLocalContext();
  const workspaceId = context?.defaultWorkspaceId;
  const { summary, loading, error } = useSessionSummary(workspaceId, sessionId);

  const assessment = useMemo(
    () => summary ? buildCheckLiteAssessment(summary, V1_CHECK_SCOPE) : null,
    [summary],
  );

  if (loading || !summary || !assessment) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Preparing evidence-based check…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Check could not be prepared</Text>
        <Text style={styles.body}>{error.message}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const covered = assessment.coverage.assessedItems.filter(item => item.isCovered).length;
  const total = assessment.coverage.assessedItems.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AUTOPULSE CHECK · V1</Text>
        <Text style={styles.title}>Evidence review</Text>
        <Text style={styles.subtitle}>This screen summarizes what the source Live session supports. It does not declare the vehicle healthy or failed.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Source evidence</Text>
          <Row label="Vehicle" value={vehicleId?.substring(0, 8) || assessment.vehicleId.substring(0, 8)} />
          <Row label="Session" value={assessment.sessionId.substring(0, 8)} />
          <Row label="Acquisition" value={assessment.acquisitionMode} />
          <Row label="Integrity" value={assessment.sessionIntegrity} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coverage</Text>
          <Text style={styles.coverageValue}>{assessment.coverage.overallLevel}</Text>
          <Text style={styles.body}>{covered} of {total} requested items produced durable evidence.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Observations</Text>
          {assessment.observations.map(observation => (
            <View key={observation.signalId} style={styles.observation}>
              <View style={styles.observationHeader}>
                <Text style={styles.observationName}>{observation.description}</Text>
                <Text style={styles.observationState}>{observationLabel(observation.state)}</Text>
              </View>
              <Text style={styles.observationMeta}>
                {observation.origin} · valid {observation.validReadingsCount} · no data {observation.noDataCount} · invalid {observation.invalidCount}
              </Text>
              {observation.state === 'OBSERVED' && (
                <Text style={styles.observationMeta}>
                  Observed range: {observation.min ?? '--'} – {observation.max ?? '--'}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Limitations</Text>
          {assessment.limitations.map((limitation, index) => (
            <Text key={`${index}-${limitation}`} style={styles.limitation}>• {limitation}</Text>
          ))}
        </View>

        <View style={[styles.reviewCard, !assessment.canAdvanceToProfessionalReview && styles.reviewCardBlocked]}>
          <Text style={styles.cardTitle}>Review readiness</Text>
          <Text style={styles.reviewState}>
            {assessment.canAdvanceToProfessionalReview ? 'READY FOR PROFESSIONAL REVIEW' : 'NOT READY FOR PROFESSIONAL REVIEW'}
          </Text>
          <Text style={styles.body}>
            {assessment.canAdvanceToProfessionalReview
              ? 'The evidence package is coherent enough to continue into human/domain review. No mechanical conclusion has been signed.'
              : 'The source evidence is not strong enough to advance. Resolve the recorded limitations or acquire a valid physical session.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back to session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E11' },
  center: { flex: 1, backgroundColor: '#0A0E11', alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 20, backgroundColor: '#111518', borderBottomWidth: 1, borderBottomColor: '#2A3136' },
  eyebrow: { color: '#FF6B00', fontSize: 11, fontFamily: 'SpaceMono_700Bold', letterSpacing: 0.8 },
  title: { color: '#FFF', fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 6 },
  subtitle: { color: '#9ca3af', fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginTop: 8 },
  content: { padding: 16, paddingBottom: 28 },
  card: { backgroundColor: '#111518', borderRadius: 12, borderWidth: 1, borderColor: '#2A3136', padding: 16, marginBottom: 14 },
  reviewCard: { backgroundColor: '#111518', borderRadius: 12, borderWidth: 1, borderColor: '#4ade80', padding: 16, marginBottom: 14 },
  reviewCardBlocked: { borderColor: '#f59e0b' },
  cardTitle: { color: '#FFF', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 10 },
  coverageValue: { color: '#60a5fa', fontSize: 22, fontFamily: 'SpaceMono_700Bold', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#20282D', paddingVertical: 9 },
  rowLabel: { color: '#8E8E93', fontSize: 13, fontFamily: 'Inter_400Regular' },
  rowValue: { color: '#FFF', fontSize: 13, fontFamily: 'SpaceMono_400Regular' },
  observation: { borderTopWidth: 1, borderTopColor: '#20282D', paddingVertical: 12 },
  observationHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  observationName: { color: '#FFF', flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  observationState: { color: '#60a5fa', fontSize: 11, fontFamily: 'SpaceMono_700Bold' },
  observationMeta: { color: '#8E8E93', fontSize: 11, fontFamily: 'SpaceMono_400Regular', marginTop: 5 },
  limitation: { color: '#d1d5db', fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  reviewState: { color: '#FFF', fontSize: 13, fontFamily: 'SpaceMono_700Bold', marginBottom: 8 },
  body: { color: '#9ca3af', fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  loadingText: { color: '#d1d5db', fontSize: 14, marginTop: 16, fontFamily: 'Inter_400Regular' },
  errorTitle: { color: '#ef4444', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 8 },
  footer: { padding: 16, paddingBottom: 32, backgroundColor: '#111518', borderTopWidth: 1, borderTopColor: '#2A3136' },
  secondaryButton: { borderWidth: 1, borderColor: '#4b5563', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  secondaryButtonText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_500Medium' },
});
