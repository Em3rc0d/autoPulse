import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useLocalContext } from '../infrastructure/hooks/useLocalContext';
import { useSessions } from '../infrastructure/hooks/useSessions';
import { useVehicle } from '../infrastructure/hooks/useVehicle';
import { useVehicles } from '../infrastructure/hooks/useVehicles';

function formatDuration(startedAt?: number, endedAt?: number) {
  if (!startedAt || !endedAt) return '0s';
  const diff = Math.max(0, endedAt - startedAt);
  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'COMPLETED': return '#4ade80'; // Green
    case 'INTERRUPTED': return '#fbbf24'; // Yellow
    case 'FAILED': return '#ef4444'; // Red
    case 'ABORTED': return '#9ca3af'; // Gray
    default: return '#fbbf24';
  }
}

export default function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const context = useLocalContext();
  
  // Extract context from params. When entering from tab, params might be undefined.
  const routeVehicleId = route.params?.vehicleId;
  const isContextual = !!routeVehicleId;

  // If navigating from the tab directly, we want to clear the filter.
  // Actually, React Navigation preserves tab params. 
  // To avoid sticky params when tapping the tab icon directly, we can listen to tabPress, 
  // but for simplicity, we just trust the route params provided by navigate('History', { vehicleId }).
  
  const { sessions, loading } = useSessions({
    workspaceId: context.context?.defaultWorkspaceId,
    vehicleId: routeVehicleId
  });

  const { vehicle } = useVehicle(routeVehicleId);
  const { vehicles } = useVehicles();

  const vehicleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of vehicles) {
      map[v.id] = v.alias;
    }
    return map;
  }, [vehicles]);

  const headerTitle = isContextual 
    ? `${vehicle?.alias?.toUpperCase() || 'VEHICLE'} HISTORY` 
    : 'HISTORY / ALL VEHICLES';

  const renderItem = ({ item }: { item: any }) => {
    const vAlias = vehicleMap[item.vehicleId] || 'Unknown Vehicle';
    const durationStr = formatDuration(item.startedAt, item.endedAt || item.completedAt || item.recoveredAt);
    
    // As per rules, if mode is unknown, default to "OBD2" or "OBD2 session"
    const adapterMode = item.adapterInstanceId ? 'OBD2' : 'OBD2 session';

    const isToday = new Date(item.startedAt).toDateString() === new Date().toDateString();
    const datePrefix = isToday ? 'Today' : new Date(item.startedAt).toLocaleDateString();
    const timeStr = new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('Live', { 
          screen: 'SessionSummary', 
          params: { vehicleId: item.vehicleId, sessionId: item.id } 
        })}
      >
        <View style={styles.cardRow}>
          <Text style={styles.cardContext}>
            {!isContextual ? `${vAlias}  ·  ` : ''}{datePrefix} · {timeStr}
          </Text>
          <Text style={[styles.cardStatus, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardDetails}>
            {durationStr} · {adapterMode}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#4A4A4E" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {isContextual && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, isContextual && { textAlign: 'left', marginLeft: 16 }]}>
          {headerTitle}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📜</Text>
          <Text style={styles.emptyText}>No sessions found</Text>
          <Text style={styles.emptySub}>
            {isContextual 
              ? `There are no recorded sessions for ${vehicle?.alias || 'this vehicle'}.` 
              : 'Complete a Live session and it will appear here.'}
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Garage')}
          >
            <Text style={styles.ctaText}>Go to Garage</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E11' },
  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#2A3136',
    backgroundColor: '#111518'
  },
  backButton: {
    paddingRight: 8,
  },
  headerTitle: { 
    color: '#8E8E93', 
    fontSize: 13, 
    fontFamily: 'SpaceGrotesk_700Bold', 
    letterSpacing: 2, 
    textAlign: 'center',
    flex: 1
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#FFF', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 12, textAlign: 'center' },
  emptySub: { color: '#8E8E93', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  ctaButton: { backgroundColor: '#FF6B00', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  ctaText: { color: '#000', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.5 },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#111518',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3136',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardContext: {
    color: '#E5E7EB',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  cardStatus: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
  cardDetails: {
    color: '#8E8E93',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
  }
});
