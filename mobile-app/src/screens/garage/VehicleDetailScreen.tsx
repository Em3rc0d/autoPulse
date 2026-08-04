import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useVehicleSessions } from '../../infrastructure/hooks/useVehicleSessions';

export default function VehicleDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const vehicleId = route.params?.vehicleId;
  const { vehicle, loading, error } = useVehicle(vehicleId);
  const { context } = useLocalContext();
  const { sessions, loading: sessionsLoading } = useVehicleSessions(context?.activeWorkspaceId, vehicleId);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleLiveSession = () => {
    navigation.navigate('Live', { screen: 'ConnectObd', params: { vehicleId } });
  };

  const handleCapabilities = () => {
    navigation.navigate('Garage', { screen: 'VehicleCapabilities', params: { vehicleId } });
  };

  const handleArchive = () => {
    setIsMenuVisible(false);
    // User requested confirmation
    Alert.alert(
      `Archive ${vehicle?.alias || 'Vehicle'}?`,
      "The vehicle will be hidden from Garage. Its sessions and history will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: () => Alert.alert("Coming soon", "Archive functionality is coming soon.") }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  if (error || !vehicle) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Could not load vehicle</Text>
        <TouchableOpacity style={styles.backButtonCenter} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerAlias}>{vehicle.alias}</Text>
          <Text style={styles.headerDesc}>
            {vehicle.make || 'Unknown'} {vehicle.model || ''} • {vehicle.year || 'N/A'}
          </Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => setIsMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Connect OBD2 CTA removed as per instructions, replaced by Live Data grid item */}

        {/* Health Snapshot */}
        <View style={styles.healthSnapshot}>
          <Text style={styles.sectionTitle}>HEALTH SNAPSHOT</Text>
          <View style={styles.healthContent}>
            <View style={styles.healthIcon}>
              <Ionicons name="checkmark-circle" size={40} color="#34C759" />
            </View>
            <View style={styles.healthInfo}>
              <Text style={styles.healthStatus}>No DTCs Found</Text>
              <Text style={styles.healthTime}>Last checked: Never</Text>
            </View>
          </View>
        </View>

        {/* Action Grid (2x2) */}
        <View style={styles.actionGrid}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionCard, styles.actionCardLive]} onPress={handleLiveSession}>
              <View style={styles.cardHeader}>
                <Ionicons name="speedometer-outline" size={24} color="#FF6B00" />
              </View>
              <Text style={[styles.actionText, { color: '#FF6B00' }]}>LIVE DATA</Text>
              <Text style={styles.actionSubText}>Connect an OBD2 adapter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleCapabilities}>
              <View style={styles.cardHeader}>
                <Ionicons name="build-outline" size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.actionText, { color: '#3b82f6' }]}>CAPABILITIES</Text>
              <Text style={styles.actionSubText}>Supported parameters</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionRow}>
            <View style={[styles.actionCard, styles.actionCardDisabled]}>
              <View style={styles.cardHeader}>
                <Ionicons name="stats-chart-outline" size={24} color="#555" />
                <View style={styles.badgeSoon}>
                  <Text style={styles.badgeText}>SOON</Text>
                </View>
              </View>
              <Text style={[styles.actionText, { color: '#888' }]}>ANALYTICS</Text>
              <Text style={[styles.actionSubText, { color: '#555' }]}>Available after recorded sessions</Text>
            </View>
            <View style={[styles.actionCard, styles.actionCardDisabled]}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={24} color="#555" />
                <View style={styles.badgeCheck}>
                  <Text style={styles.badgeText}>CHECK</Text>
                </View>
              </View>
              <Text style={[styles.actionText, { color: '#888' }]}>REPORTS</Text>
              <Text style={[styles.actionSubText, { color: '#555' }]}>Available with AutoPulse Check</Text>
            </View>
          </View>
        </View>

        {/* Recent Sessions */}
        <View style={styles.sessionsContainer}>
          <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
          {sessionsLoading ? (
            <ActivityIndicator size="small" color="#FF6B00" style={{ marginTop: 24 }} />
          ) : sessions.length === 0 ? (
            <View style={styles.emptySessions}>
              <Text style={styles.emptySessionsText}>No recent sessions recorded.</Text>
            </View>
          ) : (
            sessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => navigation.navigate('Live', { screen: 'SessionSummary', params: { vehicleId, sessionId: session.id } })}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionDate}>{new Date(session.startedAt).toLocaleString()}</Text>
                  <Text style={[styles.sessionStatus, session.status === 'COMPLETED' ? { color: '#4ade80' } : { color: '#fbbf24' }]}>
                    {session.status}
                  </Text>
                </View>
                <View style={styles.sessionDetails}>
                  <Text style={styles.sessionDetailText}>Adapter: {session.adapterInstanceId}</Text>
                  <Text style={styles.sessionDetailText}>Blocks: {session.totalBlocks}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Action Sheet Modal */}
      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.bottomSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Vehicle Options</Text>
              </View>

              <TouchableOpacity style={styles.sheetAction} onPress={() => { setIsMenuVisible(false); Alert.alert('Coming soon', 'Edit Vehicle form'); }}>
                <Ionicons name="create-outline" size={24} color="#FFF" style={styles.sheetIcon} />
                <Text style={styles.sheetActionText}>Edit Vehicle</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetAction} onPress={() => { setIsMenuVisible(false); Alert.alert('Coming soon', 'Set as primary vehicle'); }}>
                <Ionicons name="star-outline" size={24} color="#FFF" style={styles.sheetIcon} />
                <Text style={styles.sheetActionText}>Set as Primary</Text>
              </TouchableOpacity>

              <View style={styles.sheetActionInfo}>
                <Ionicons name="information-circle-outline" size={24} color="#8E8E93" style={styles.sheetIcon} />
                <View>
                  <Text style={styles.sheetInfoText}>Alias: {vehicle?.alias}</Text>
                  <Text style={styles.sheetInfoText}>Make: {vehicle?.make} {vehicle?.model} {vehicle?.year}</Text>
                  <Text style={styles.sheetInfoText}>ID: {vehicleId?.substring(0, 8)}...</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.sheetAction} onPress={handleArchive}>
                <Ionicons name="archive-outline" size={24} color="#FF3B30" style={styles.sheetIcon} />
                <Text style={[styles.sheetActionText, { color: '#FF3B30' }]}>Archive Vehicle</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetCancel} onPress={() => setIsMenuVisible(false)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E11',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0A0E11',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonCenter: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#111518',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3136',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerAlias: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
  },
  headerDesc: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    padding: 8,
    marginRight: -8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  connectCard: {
    backgroundColor: '#161C20',
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  connectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectTitle: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 18,
  },
  connectSub: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#000',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#666',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  healthSnapshot: {
    marginBottom: 24,
  },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111518',
    borderRadius: 12,
    padding: 16,
  },
  healthIcon: {
    marginRight: 16,
  },
  healthInfo: {
    flex: 1,
  },
  healthStatus: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 16,
  },
  healthTime: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
  actionGrid: {
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#111518',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2A3136',
    minHeight: 110,
    justifyContent: 'flex-start'
  },
  actionCardLive: {
    borderColor: 'rgba(255, 107, 0, 0.5)',
    backgroundColor: 'rgba(255, 107, 0, 0.05)',
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  badgeSoon: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCheck: {
    backgroundColor: '#1E3A8A', // A distinct blue for AutoPulse Check
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  actionText: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  actionSubText: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
  sessionsContainer: {
    flex: 1,
  },
  emptySessions: {
    flex: 1,
    backgroundColor: '#111518',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A3136',
    borderStyle: 'dashed',
    minHeight: 120,
  },
  emptySessionsText: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  sessionCard: {
    backgroundColor: '#111518',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3136',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionDate: {
    color: '#FFF',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  sessionStatus: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionDetailText: {
    color: '#8E8E93',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#161C20',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3136',
  },
  sheetActionInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3136',
  },
  sheetIcon: {
    marginRight: 16,
  },
  sheetActionText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  sheetInfoText: {
    color: '#9ca3af',
    fontSize: 13,
    fontFamily: 'SpaceMono_400Regular',
    marginBottom: 4,
  },
  sheetCancel: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#2A3136',
    borderRadius: 8,
  },
  sheetCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  }
});
