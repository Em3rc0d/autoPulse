import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useCapabilitySnapshot } from '../../infrastructure/hooks/useCapabilitySnapshot';

export default function VehicleCapabilitiesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const vehicleId = route.params?.vehicleId;
  const { vehicle } = useVehicle(vehicleId);
  const { context } = useLocalContext();

  const { snapshot, parameters, loading } = useCapabilitySnapshot(context?.defaultWorkspaceId, vehicleId);

  const getStatusColor = (supportState: string, outcome: string) => {
    if (supportState === 'SUPPORTED') return '#4ade80';
    if (supportState === 'NOT_SUPPORTED') return '#9ca3af'; // Not a failure, just not supported
    
    // UNKNOWN state logic
    if (outcome === 'NOT_ATTEMPTED') return '#6b7280'; // Darker grey
    if (['TIMEOUT', 'NO_DATA', 'NO_RESPONSE'].includes(outcome)) return '#fbbf24'; // Amber
    if (['NEGATIVE_RESPONSE', 'INVALID_RESPONSE', 'TRANSPORT_ERROR'].includes(outcome)) return '#ef4444'; // Red
    return '#9ca3af';
  };

  const getStatusLabel = (supportState: string) => {
    switch (supportState) {
      case 'SUPPORTED': return 'Supported';
      case 'NOT_SUPPORTED': return 'Not Supported';
      case 'UNKNOWN': return 'Unknown';
      default: return supportState;
    }
  };

  const getEvidenceDescription = (origin: string, outcome: string) => {
    if (outcome === 'NOT_ATTEMPTED') return 'Not tested';
    if (origin === 'BITMAP' && outcome === 'SUCCESS') return 'Confirmed by bitmap';
    if (origin === 'DIRECT_OBSERVATION' && outcome === 'SUCCESS') return 'Confirmed by direct response';
    if (origin === 'REPLAY_FIXTURE' && outcome === 'SUCCESS') return 'Confirmed by laptop replay';
    
    if (origin === 'PROBE') {
      const outcomeText = outcome.replace('_', ' ').toLowerCase();
      return `Probe returned ${outcomeText.toUpperCase()}`;
    }
    return `Outcome: ${outcome}`;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading snapshot...</Text>
        </View>
      );
    }

    if (!snapshot) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="hardware-chip-outline" size={64} color="#374151" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Supported data has not been checked yet.</Text>
          <Text style={styles.emptyDesc}>
            Connect an OBD-II adapter to inspect this vehicle.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Live', { screen: 'ConnectObd', params: { vehicleId } })}
          >
            <Text style={styles.primaryButtonText}>Connect OBD2</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.snapshotInfo}>
          <Text style={styles.snapshotInfoText}>Discovered: {new Date(snapshot.discoveredAt).toLocaleString()}</Text>
          <Text style={styles.snapshotInfoText}>Protocol: {snapshot.protocolCode}</Text>
          <Text style={styles.snapshotInfoText}>Adapter: {snapshot.adapterInstanceId}</Text>
        </View>

        {parameters.length === 0 ? (
          <Text style={styles.emptyDesc}>No parameters recorded in this snapshot.</Text>
        ) : (
          parameters.map(param => {
            // When definition is null due to leftJoin, we reconstruct it from parameterDefinitionId if possible
            const fallbackService = param.service ?? (param.parameterDefinitionId ? parseInt(param.parameterDefinitionId.substring(0, 2), 16) : 0);
            const fallbackPid = param.parameterIdentifier ?? (param.parameterDefinitionId ? parseInt(param.parameterDefinitionId.substring(2, 4), 16) : 0);

            const badgeColor = getStatusColor(param.supportState, param.discoveryOutcome);

            return (
            <View key={param.id} style={styles.paramCard}>
              <View style={styles.paramHeader}>
                <Text style={styles.paramName}>{param.technicalName ?? 'Unknown Parameter'}</Text>
                <View style={[styles.statusBadge, { borderColor: badgeColor }]}>
                  <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                    {getStatusLabel(param.supportState)}
                  </Text>
                </View>
              </View>
              <Text style={styles.paramPid}>Mode {fallbackService.toString(16).padStart(2, '0').toUpperCase()} · PID {fallbackPid.toString(16).padStart(2, '0').toUpperCase()} (ECU {param.ecuAddress.toString(16).toUpperCase()})</Text>
              
              <Text style={styles.paramEvidence}>{getEvidenceDescription(param.evidenceOrigin, param.discoveryOutcome)}</Text>

              {param.errorCode && (
                <View style={styles.errorContainer}>
                  <Text style={styles.paramError}>{param.errorCode}</Text>
                </View>
              )}
            </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Capabilities</Text>
          <Text style={styles.subtitle}>{vehicle?.alias || 'Loading...'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1417' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1a2227',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3439',
  },
  backButton: { padding: 8, marginLeft: -8, width: 40 },
  headerInfo: { flex: 1, alignItems: 'center' },
  title: { color: '#FFF', fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  subtitle: { color: '#9ca3af', fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9ca3af', marginTop: 16, fontFamily: 'Inter_400Regular' },

  scrollContainer: { flex: 1 },

  snapshotInfo: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151'
  },
  snapshotInfoText: { color: '#9ca3af', fontSize: 13, fontFamily: 'SpaceMono_400Regular', marginBottom: 4 },

  paramCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151'
  },
  paramHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  paramName: { color: '#e5e7eb', fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1, marginRight: 8 },
  paramPid: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'SpaceMono_400Regular',
    marginTop: 4,
  },
  paramEvidence: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  paramError: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: 'SpaceMono_700Bold',
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  emptyState: {
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginTop: 32
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginBottom: 12
  },
  emptyDesc: {
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  }
});
