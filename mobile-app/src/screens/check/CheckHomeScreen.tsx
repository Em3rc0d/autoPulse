import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StoredAutoPulseCheck } from '../../application/check/AutoPulseCheckEngine';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { CheckEvaluationRepository } from '../../infrastructure/database/product/repositories/check-evaluation.repository';
import { VehicleRepository } from '../../infrastructure/database/product/repositories/vehicle.repository';

type VehicleRow = {
  id: string;
  alias: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
};

export default function CheckHomeScreen() {
  const navigation = useNavigation<any>();
  const db = useProductDb();
  const { context } = useLocalContext();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [checks, setChecks] = useState<StoredAutoPulseCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!db || !context?.defaultWorkspaceId) return;
    setLoading(true);
    try {
      const vehicleRepo = new VehicleRepository(db);
      const checkRepo = new CheckEvaluationRepository(db);
      const [nextVehicles, nextChecks] = await Promise.all([
        vehicleRepo.listVehicles(context.defaultWorkspaceId),
        checkRepo.listRecent(context.defaultWorkspaceId, 12),
      ]);
      setVehicles(nextVehicles as VehicleRow[]);
      setChecks(nextChecks);
    } catch (error) {
      console.error('[AutoPulseCheck] Failed to load Check home:', error);
    } finally {
      setLoading(false);
    }
  }, [db, context?.defaultWorkspaceId]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const vehicleLabel = (vehicle: VehicleRow) => {
    const identity = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
    return identity || 'Vehicle profile';
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>AUTOPULSE CHECK</Text>
        <Text style={styles.title}>Vehicle review</Text>
        <Text style={styles.subtitle}>
          Build a traceable evaluation from what was actually inspected, observed and captured.
        </Text>

        <View style={styles.truthCard}>
          <Text style={styles.truthTitle}>Evidence first</Text>
          <Text style={styles.truthText}>
            Unknown is not pass. Unsupported systems stay visible. OBD evidence never becomes a full mechanical inspection by itself.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Start a Check</Text>
        {loading && vehicles.length === 0 ? (
          <ActivityIndicator color="#a3e635" style={styles.loader} />
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No vehicle yet</Text>
            <Text style={styles.emptyText}>Add a vehicle in Garage before starting an evaluation.</Text>
          </View>
        ) : (
          vehicles.map(vehicle => (
            <TouchableOpacity
              key={vehicle.id}
              style={styles.vehicleCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('NewCheck', { vehicleId: vehicle.id })}
            >
              <View style={styles.vehicleCopy}>
                <Text style={styles.vehicleAlias}>{vehicle.alias}</Text>
                <Text style={styles.vehicleIdentity}>{vehicleLabel(vehicle)}</Text>
              </View>
              <View style={styles.startPill}>
                <Text style={styles.startPillText}>Review</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.sectionTitle, styles.recentTitle]}>Recent evaluations</Text>
        {checks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No AutoPulse Check evaluations have been recorded yet.</Text>
          </View>
        ) : (
          checks.map(check => (
            <TouchableOpacity
              key={check.evaluation.id}
              style={styles.checkRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CheckEvaluation', { evaluationId: check.evaluation.id })}
            >
              <View style={styles.vehicleCopy}>
                <Text style={styles.checkPurpose}>{check.purpose.replace(/_/g, ' ')}</Text>
                <Text style={styles.checkMeta}>{check.evaluation.state.replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  eyebrow: { color: '#84cc16', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#f8fafc', fontSize: 34, fontWeight: '700', marginTop: 7 },
  subtitle: { color: '#94a3b8', fontSize: 15, lineHeight: 22, marginTop: 8 },
  truthCard: { marginTop: 22, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#111a1f' },
  truthTitle: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  truthText: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 6 },
  sectionTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '800', marginTop: 26, marginBottom: 10 },
  recentTitle: { marginTop: 30 },
  loader: { marginVertical: 22 },
  emptyCard: { padding: 16, borderRadius: 14, backgroundColor: '#11181d', borderWidth: 1, borderColor: '#26343d' },
  emptyTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#7f8ea3', fontSize: 12, lineHeight: 18, marginTop: 3 },
  vehicleCard: { minHeight: 74, borderRadius: 16, borderWidth: 1, borderColor: '#334155', backgroundColor: '#131c22', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  vehicleCopy: { flex: 1 },
  vehicleAlias: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  vehicleIdentity: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  startPill: { borderRadius: 999, backgroundColor: '#d9ff3f', paddingHorizontal: 13, paddingVertical: 8 },
  startPillText: { color: '#182108', fontSize: 12, fontWeight: '900' },
  checkRow: { minHeight: 66, borderBottomWidth: 1, borderBottomColor: '#1f2a30', flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkPurpose: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  checkMeta: { color: '#7f8ea3', fontSize: 11, marginTop: 4 },
  chevron: { color: '#64748b', fontSize: 28 },
});
