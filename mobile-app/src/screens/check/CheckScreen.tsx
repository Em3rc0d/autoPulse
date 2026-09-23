import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../../infrastructure/hooks/useVehicles';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { useAppLanguage } from '../../application/i18n/AppLanguage';

export default function CheckScreen() {
  const navigation = useNavigation<any>();
  const { vehicles, loading, error, refresh } = useVehicles();
  const { text } = useAppLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{text("ECU DIAGNOSTICS · READ ONLY", "DIAGNÓSTICO ECU · SOLO LECTURA")}</Text>
        <Text style={styles.title}>Check</Text>
        <Text style={styles.subtitle}>{text("Ask the vehicle's ECU what diagnostic evidence it reports now. No prior Live session is required.", "Consulta qué evidencia diagnóstica reporta la ECU ahora. No necesitas una sesión Live previa.")}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4ade80" /><Text style={styles.centerText}>{text("Loading vehicles…", "Cargando vehículos…")}</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>{text("Could not load Garage vehicles.", "No se pudieron cargar los vehículos del Garaje.")}</Text><TouchableOpacity style={styles.secondary} onPress={() => void refresh()}><Text style={styles.secondaryText}>{text("Retry", "Reintentar")}</Text></TouchableOpacity></View>
      ) : vehicles.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyTitle}>{text("Add a vehicle first", "Agrega un vehículo primero")}</Text><Text style={styles.centerText}>{text("Check needs a Garage vehicle for report context, but it does not need a Live session.", "Check necesita un vehículo del Garaje para el contexto del reporte, pero no necesita una sesión Live.")}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{text("Physical pilot", "Piloto físico")}</Text>
            <Text style={styles.noticeText}>{text("Park the vehicle before starting. The first activated set is descriptor-gated standard OBD: PID capability plus DTC services supported by the proven protocol/parser path.", "Estaciona el vehículo antes de iniciar. Check usa OBD estándar de solo lectura y únicamente comandos promovidos por seguridad.")}</Text>
          </View>

          <Text style={styles.section}>{text("Choose vehicle", "Elige vehículo")}</Text>
          {vehicles.map((vehicle: any) => {
            const retained = activeBleController.getActiveConnection();
            const canReuse = Boolean(
              retained &&
              retained.vehicleId === vehicle.id &&
              activeBleController.getOwner() === 'IDLE'
            );

            return (
              <TouchableOpacity
                key={vehicle.id}
                style={styles.card}
                onPress={() => canReuse && retained
                  ? navigation.navigate('CheckRun', {
                      vehicleId: vehicle.id,
                      connectionHandleId: retained.connectionHandleId,
                      adapterInstanceId: retained.adapterInstanceId,
                    })
                  : navigation.navigate('CheckConnect', { vehicleId: vehicle.id })}
                testID={`check-vehicle-${vehicle.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicle}>{vehicle.alias || text('Vehicle', 'Vehículo')}</Text>
                  <Text style={styles.meta}>
                    {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || text('Garage vehicle', 'Vehículo del Garaje')}
                    {canReuse ? text(' · OBD connected', ' · OBD conectado') : ''}
                  </Text>
                </View>
                <Text style={styles.open}>{canReuse ? text('Use connected OBD →', 'Usar OBD conectado →') : text('Run Check →', 'Ejecutar Check →')}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.boundary}>
            <Text style={styles.boundaryTitle}>{text("What this is not", "Qué no es")}</Text>
            <Text style={styles.boundaryText}>{text("Check does not create a mechanical PASS/FAIL verdict. No DTCs reported by scanned services does not mean the whole vehicle is healthy. ABS, SRS, transmission and manufacturer-enhanced modules are not inferred.", "Check no emite un veredicto mecánico PASS/FAIL. Que no aparezcan DTC en los servicios escaneados no significa que todo el vehículo esté sano. ABS, SRS, transmisión y módulos del fabricante no se infieren.")}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  eyebrow: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { color: '#fff', fontSize: 31, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 7 },
  content: { padding: 18, paddingBottom: 52 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  centerText: { color: '#94a3b8', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  emptyTitle: { color: '#f8fafc', fontSize: 19, fontWeight: '800' },
  error: { color: '#fca5a5', fontWeight: '800' },
  notice: { backgroundColor: '#0c2a1a', borderWidth: 1, borderColor: '#166534', borderRadius: 16, padding: 16, marginBottom: 22 },
  noticeTitle: { color: '#4ade80', fontSize: 15, fontWeight: '900' },
  noticeText: { color: '#cbd5e1', lineHeight: 20, marginTop: 7 },
  section: { color: '#e2e8f0', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 12 },
  vehicle: { color: '#f8fafc', fontSize: 18, fontWeight: '900' },
  meta: { color: '#64748b', fontSize: 11, marginTop: 5 },
  open: { color: '#60a5fa', fontSize: 12, fontWeight: '900' },
  boundary: { borderTopWidth: 1, borderTopColor: '#263139', marginTop: 16, paddingTop: 18 },
  boundaryTitle: { color: '#fbbf24', fontWeight: '900', fontSize: 14 },
  boundaryText: { color: '#94a3b8', lineHeight: 20, marginTop: 7 },
  secondary: { marginTop: 18, borderWidth: 1, borderColor: '#475569', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  secondaryText: { color: '#e2e8f0', fontWeight: '800' },
});
