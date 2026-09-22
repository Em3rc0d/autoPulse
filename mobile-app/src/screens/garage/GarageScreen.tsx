import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicles } from '../../infrastructure/hooks/useVehicles';
import { useAppLanguage } from '../../application/i18n/AppLanguage';

export default function GarageScreen() {
  const { vehicles, loading, error } = useVehicles();
  const navigation = useNavigation<any>();
  const { text } = useAppLanguage();

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{text("Could not load vehicles", "No se pudieron cargar los vehículos")}</Text>
        <Text style={styles.errorSub}>{error.message}</Text>
      </View>
    );
  }

  const primaryVehicle = vehicles[0];
  const secondaryVehicles = vehicles.slice(1, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>{text("Welcome back", "Bienvenido")}</Text>
        <Text style={styles.title}>{text("My Garage", "Mi Garaje")}</Text>
        <View style={styles.workspaceBadge}>
          <Ionicons name="home-outline" size={16} color="#8E8E93" />
          <Text style={styles.workspaceText}>{text("Local Workspace", "Espacio local")}</Text>
          <View style={styles.tag}><Text style={styles.tagText}>{text("LOCAL", "LOCAL")}</Text></View>
        </View>
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-sport-outline" size={80} color="#333" />
          <Text style={styles.emptyTitle}>{text("No vehicles yet", "Aún no hay vehículos")}</Text>
          <Text style={styles.emptySub}>{text("Add your first vehicle to start tracking telemetry.", "Agrega tu primer vehículo para comenzar a registrar telemetría.")}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('AddVehicle')}
          >
            <Text style={styles.primaryButtonText}>{text("ADD VEHICLE", "AGREGAR VEHÍCULO")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Primary Vehicle */}
          <View style={styles.primaryCard}>
            <View style={styles.primaryHeader}>
              <View style={styles.primaryTag}><Ionicons name="star" size={12} color="#FF6B00" /><Text style={styles.primaryTagText}>{text("PRIMARY", "PRINCIPAL")}</Text></View>
            </View>
            <View style={styles.primaryDetails}>
              <Text style={styles.vehicleName}>{primaryVehicle.alias}</Text>
              <Text style={styles.vehicleDesc}>
                {primaryVehicle.make || text('Unknown', 'Desconocido')} {primaryVehicle.model || ''} • {primaryVehicle.year || text('N/A', 'N/D')}
              </Text>
              {primaryVehicle.vin && <Text style={styles.vinText}>VIN: {primaryVehicle.vin}</Text>}
            </View>
            <TouchableOpacity
              style={styles.openButton}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: primaryVehicle.id })}
            >
              <Ionicons name="car-outline" size={20} color="#000" />
              <Text style={styles.openButtonText}>{text("OPEN VEHICLE", "ABRIR VEHÍCULO")}</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Vehicles */}
          {secondaryVehicles.length > 0 && (
            <View style={styles.secondaryRow}>
              {secondaryVehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.secondaryCard}
                  onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}
                >
                  <Text style={styles.secondaryName} numberOfLines={1}>{v.alias}</Text>
                  <Text style={styles.secondaryDesc} numberOfLines={1}>
                    {v.make || text('Unknown', 'Desconocido')} {v.model || ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#666" style={{ alignSelf: 'flex-end', marginTop: 8 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Add Vehicle Button (if not empty) */}
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => navigation.navigate('AddVehicle')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#8E8E93" />
            <Text style={styles.outlineButtonText}>{text("ADD VEHICLE", "AGREGAR VEHÍCULO")}</Text>
          </TouchableOpacity>

          {/* Insights */}
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>{text("GARAGE INSIGHTS", "RESUMEN DEL GARAJE")}</Text>
            <View style={styles.insightsRow}>
              <View style={styles.insightItem}>
                <Text style={styles.insightValue}>{vehicles.length}</Text>
                <Text style={styles.insightLabel}>{text("Total Vehicles", "Vehículos totales")}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E11', // Very dark near black
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0A0E11',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    marginTop: 16,
  },
  errorSub: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
  },
  header: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 16,
  },
  welcomeText: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  title: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    marginTop: 4,
  },
  workspaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  workspaceText: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    marginLeft: 8,
    marginRight: 12,
  },
  tag: {
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    borderColor: '#FF6B00',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    color: '#FF6B00',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 20,
    marginTop: 16,
  },
  emptySub: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#000',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  primaryCard: {
    backgroundColor: '#161C20', // Graphite
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3136',
    padding: 16,
    marginBottom: 16,
  },
  primaryHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  primaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
    borderColor: '#FF6B00',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  primaryTagText: {
    color: '#FF6B00',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    marginLeft: 4,
  },
  primaryDetails: {
    marginBottom: 24,
  },
  vehicleName: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 24,
  },
  vehicleDesc: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 4,
  },
  vinText: {
    color: '#666',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
  openButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: {
    color: '#000',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    marginLeft: 8,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: '#161C20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3136',
    padding: 12,
    marginHorizontal: 4,
  },
  secondaryName: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 16,
  },
  secondaryDesc: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 24,
  },
  outlineButtonText: {
    color: '#8E8E93',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    marginLeft: 8,
  },
  insightsCard: {
    backgroundColor: '#111518',
    borderRadius: 12,
    padding: 16,
  },
  insightsTitle: {
    color: '#666',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    marginBottom: 12,
  },
  insightsRow: {
    flexDirection: 'row',
  },
  insightItem: {
    marginRight: 32,
  },
  insightValue: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 24,
  },
  insightLabel: {
    color: '#8E8E93',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 4,
  }
});
