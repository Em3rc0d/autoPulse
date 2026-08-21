import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useCapabilitySnapshot } from '../../infrastructure/hooks/useCapabilitySnapshot';

type CapabilityTone = 'available' | 'observed' | 'pending' | 'unavailable' | 'unknown';

export function getCapabilityPresentation(param: any): {
  label: string;
  explanation: string;
  tone: CapabilityTone;
} {
  if (param.supportState === 'DIRECTLY_OBSERVED' || param.probeResult === 'SUCCESS') {
    return { label: 'Observed', explanation: 'The vehicle answered this signal directly.', tone: 'observed' };
  }
  if (param.supportState === 'SUPPORTED' || param.capabilityAdvertisedState === 'ADVERTISED') {
    return { label: 'Available', explanation: 'The vehicle reports that this signal is available.', tone: 'available' };
  }
  if (['NOT_AVAILABLE', 'NOT_SUPPORTED', 'NO_RESPONSE'].includes(param.supportState)) {
    return { label: 'Unavailable', explanation: 'No usable reading is available from this vehicle.', tone: 'unavailable' };
  }
  if (param.supportState === 'PROBE_PENDING' || param.probeResult === 'NOT_PROBED') {
    return { label: 'Not observed yet', explanation: 'AutoPulse has not received a direct reading yet.', tone: 'pending' };
  }
  return { label: 'Unknown', explanation: 'There is not enough evidence to classify this signal.', tone: 'unknown' };
}

export function getCapabilityGroup(requestId?: string): string {
  switch (requestId) {
    case '0105':
    case '010F':
      return 'Temperatures';
    case '010D':
      return 'Movement';
    case '0142':
      return 'Electrical';
    default:
      return 'Engine';
  }
}

export default function VehicleCapabilitiesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const vehicleId = route.params?.vehicleId;
  const { vehicle } = useVehicle(vehicleId);
  const { context } = useLocalContext();

  const { snapshot, parameters, loading } = useCapabilitySnapshot(context?.defaultWorkspaceId, vehicleId);

  const getStatusColor = (tone: CapabilityTone) => {
    switch (tone) {
      case 'available': return '#4ade80';
      case 'observed': return '#22d3ee';
      case 'unavailable': return '#ef4444';
      case 'pending': return '#fbbf24';
      default: return '#9ca3af';
    }
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
          ['Engine', 'Temperatures', 'Movement', 'Electrical'].map(group => {
            const groupedParameters = parameters.filter(param =>
              getCapabilityGroup(param.observedRequestId ?? param.parameterDefinitionId) === group
            );
            if (groupedParameters.length === 0) return null;

            return (
              <View key={group} style={styles.groupSection}>
                <Text style={styles.groupTitle}>{group}</Text>
                {groupedParameters.map(param => {
                  const fallbackService = param.service ?? (param.parameterDefinitionId
                    ? parseInt(param.parameterDefinitionId.substring(0, 2), 16)
                    : 0);
                  const fallbackPid = param.parameterIdentifier ?? (param.parameterDefinitionId
                    ? parseInt(param.parameterDefinitionId.substring(2, 4), 16)
                    : 0);
                  const presentation = getCapabilityPresentation(param);

                  return (
                    <View key={param.id} style={styles.paramCard}>
                      <View style={styles.paramHeader}>
                        <Text style={styles.paramName}>{param.technicalName ?? 'Standard OBD signal'}</Text>
                        <View style={[styles.statusBadge, { borderColor: getStatusColor(presentation.tone) }]}>
                          <Text style={[styles.statusBadgeText, { color: getStatusColor(presentation.tone) }]}>
                            {presentation.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.paramExplanation}>{presentation.explanation}</Text>
                      <Text style={styles.paramPid}>
                        Mode {fallbackService.toString(16).padStart(2, '0').toUpperCase()} PID {fallbackPid.toString(16).padStart(2, '0').toUpperCase()} (ECU {param.ecuAddress.toString(16).toUpperCase()})
                      </Text>

                      {param.errorCode && (
                        <Text style={styles.paramError}>Error Code: {param.errorCode}</Text>
                      )}
                    </View>
                  );
                })}
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

  groupSection: { marginBottom: 12 },
  groupTitle: {
    color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 10
  },

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
  paramExplanation: { color: '#9ca3af', fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  paramPid: { color: '#6b7280', fontSize: 12, fontFamily: 'SpaceMono_400Regular' },
  paramError: { color: '#ef4444', fontSize: 12, fontFamily: 'SpaceMono_400Regular', marginTop: 4 },

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
