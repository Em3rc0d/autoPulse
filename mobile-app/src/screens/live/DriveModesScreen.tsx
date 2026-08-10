import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCapabilitySnapshot } from '../../infrastructure/hooks/useCapabilitySnapshot';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { DRIVING_MODES, MonitoringProfile, resolveDrivingModeSignals } from '../../domain/telemetry/DrivingModes';
import { OBD_SIGNAL_REGISTRY } from '../../domain/telemetry/ObdSignalRegistry';

export default function DriveModesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId } = route.params || {};

  const { context } = useLocalContext();
  const { parameters, loading } = useCapabilitySnapshot(context?.defaultWorkspaceId, vehicleId);

  const availableSignalIds = useMemo(() => {
    const set = new Set<string>();
    parameters.forEach(p => {
      const pidStr = p.parameterDefinitionId;
      const entry = Object.values(OBD_SIGNAL_REGISTRY).find(s => s.command === pidStr);
      if (entry) {
        set.add(entry.canonicalId);
      }
    });
    set.add('ADAPTER_VOLTAGE'); // Always available
    return set;
  }, [parameters]);

  const handleSelectMode = (profile: MonitoringProfile) => {
    navigation.navigate('Live', { screen: 'ConnectObd', params: { vehicleId, monitoringProfile: profile } });
  };

  const renderProfileCard = (profile: MonitoringProfile, description: string) => {
    const definition = DRIVING_MODES[profile];
    if (!definition) return null;

    const resolvedSignals = resolveDrivingModeSignals(profile, availableSignalIds, 4);
    const totalPreferred = Math.min(4, definition.preferredSignals.length);
    const detected = resolvedSignals.length;

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => handleSelectMode(profile)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{definition.label.toUpperCase()}</Text>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </View>
        <Text style={styles.cardDescription}>{description}</Text>
        <View style={styles.coverageRow}>
          <Text style={styles.coverageText}>
            {detected}/{totalPreferred} detected · Last scan
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>DRIVING MODES</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Monitoring profiles</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {renderProfileCard('OFF_ROAD', 'Heat · Load · Protection')}
            {renderProfileCard('PERFORMANCE', 'Power · Load · Response')}
            {renderProfileCard('FAMILY', 'Safety · Comfort · Efficiency')}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1417',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1a2227',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3439',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  content: {
    padding: 24,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#161C20',
    borderWidth: 1,
    borderColor: '#2A3136',
    borderRadius: 12,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  cardDescription: {
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  coverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverageText: {
    color: '#4ade80',
    fontSize: 12,
    fontFamily: 'SpaceMono_400Regular',
  }
});
