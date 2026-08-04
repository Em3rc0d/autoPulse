import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, PermissionsAndroid, Platform,
  ScrollView, Alert
} from 'react-native';
import { bluetoothOBD } from '../services/bluetoothOBD';
import { COLORS, FONTS, globalStyles } from '../styles/theme';

export default function BluetoothScreen({ onConnected }: { onConnected: () => void }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const requestAccess = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        return granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  const scanDevices = async () => {
    setScanning(true);
    try {
      const hasPerm = await requestAccess();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Bluetooth permissions are required.');
        setScanning(false);
        return;
      }
      const paired = await bluetoothOBD.listDevices();
      setDevices(paired);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (address: string) => {
    setConnecting(address);
    try {
      const hasPerm = await requestAccess();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Bluetooth permissions are required.');
        setConnecting(null);
        return;
      }
      const success = await bluetoothOBD.connect(address);
      if (success) {
        onConnected();
      } else {
        Alert.alert('Error', 'No se pudo conectar al ELM327.');
      }
    } catch (e) {
      Alert.alert('Error', 'Fallo en la conexión.');
    } finally {
      setConnecting(null);
    }
  };

  const handleSimulate = async () => {
    await bluetoothOBD.connectMock();
    setConnectedDevice(bluetoothOBD.getConnectedDeviceName());
    onConnected();
  };

  const handleDisconnect = async () => {
    await bluetoothOBD.disconnect();
    setConnectedDevice(null);
    scanDevices(); // Volver a buscar
  };

  useEffect(() => {
    if (bluetoothOBD.isConnected()) {
      setConnectedDevice(bluetoothOBD.getConnectedDeviceName());
    } else {
      scanDevices();
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 24, color: COLORS.onSurface }}>⚙️</Text>
          <Text style={styles.headerTitle}>SYSTEM CONFIG</Text>
          <Text style={{ fontSize: 24, color: COLORS.onSurface }}>👤</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* TELEMETRY UPLINK */}
        <Text style={styles.sectionHeader}>ENLACE DE TELEMETRÍA</Text>
        <View style={styles.searchSection}>
          <View style={[styles.btGlowBox, globalStyles.neonGlow, connectedDevice ? { borderColor: COLORS.success, shadowColor: COLORS.success } : {}]}>
            <Text style={{ fontSize: 40 }}>{connectedDevice ? '🔗' : '📶'}</Text>
          </View>
          <Text style={[styles.searchingTitle, globalStyles.textGlow, connectedDevice ? { color: COLORS.success, textShadowColor: COLORS.success } : {}]}>
            {connectedDevice ? 'CONECTADO' : (scanning ? 'BUSCANDO' : 'LISTO')}
          </Text>
          <Text style={styles.searchingSubtitle}>
            {connectedDevice ? `A: ${connectedDevice}` : 'ESPERANDO ENLACE DE TELEMETRÍA'}
          </Text>
        </View>

        {/* INTERFACES */}
        {connectedDevice ? (
          <View style={[styles.deviceCard, { borderColor: COLORS.success }]}>
             <View style={styles.deviceInfo}>
               <View style={[styles.deviceIcon, { backgroundColor: '#32D74B22' }]}><Text>✅</Text></View>
               <View style={{ flex: 1 }}>
                 <Text style={styles.deviceName}>{connectedDevice}</Text>
                 <View style={styles.readyRow}>
                   <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
                   <Text style={[styles.readyText, { color: COLORS.success }]}>TRANSMITIENDO DATOS</Text>
                 </View>
               </View>
             </View>
             <TouchableOpacity style={[styles.connectBtn, { borderColor: COLORS.error, backgroundColor: '#FF453A22' }]} onPress={handleDisconnect}>
               <Text style={[styles.connectBtnText, { color: COLORS.error }]}>DESCONECTAR</Text>
             </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>INTERFACES DISPONIBLES</Text>
              <Text style={styles.foundCount}>{devices.length} ENCONTRADOS</Text>
            </View>

            {devices.map(dev => (
              <View key={dev.address} style={styles.deviceCard}>
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceIcon}><Text>🔌</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName}>{dev.name || 'ELM327 OBD-II'}</Text>
                    <View style={styles.readyRow}>
                      <View style={[styles.statusDot, { backgroundColor: COLORS.primary }]} />
                      <Text style={styles.readyText}>LISTO PARA EMPAREJAR</Text>
                    </View>
                  </View>
                  <Text style={styles.rssi}>{dev.rssi ? `${dev.rssi} dBm` : '--'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={() => connectToDevice(dev.address)}
                  disabled={connecting !== null}
                >
                  <Text style={styles.connectBtnText}>{connecting === dev.address ? 'CONECTANDO...' : 'INICIALIZAR CONEXIÓN →'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* PROTOCOLS GRID */}
        <Text style={styles.sectionHeader}>PROTOCOLOS DE SISTEMA</Text>
        <View style={styles.protocolGrid}>
          <ProtocolCard title="ISO 15765-4 CAN" value="11/500k" active />
          <ProtocolCard title="SAE J1850 PWM" value="41.6k" />
          <ProtocolCard title="ISO 14230-4 KWP" value="FAST INIT" />
          <ProtocolCard title="ISO 9141-2" value="5 BAUD" />
        </View>

        {!connectedDevice && (
          <TouchableOpacity style={styles.simulateBtn} onPress={handleSimulate}>
            <Text style={styles.simulateBtnText}>🧪 MODO SIMULADOR (TESTING)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function ProtocolCard({ title, value, active }: any) {
  return (
    <View style={styles.protocolCard}>
      <Text style={styles.protocolTitle}>{title}</Text>
      <View style={styles.protocolFooter}>
        <Text style={styles.protocolValue}>{value}</Text>
        <Text style={{ fontSize: 12 }}>{active ? '✔️' : '💬'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: COLORS.outline, backgroundColor: COLORS.surface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: COLORS.onSurface, fontSize: 18, fontFamily: FONTS.grotesk, letterSpacing: 2 },
  content: { padding: 20 },
  searchSection: { alignItems: 'center', marginVertical: 30 },
  btGlowBox: { width: 100, height: 100, backgroundColor: COLORS.surface, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.outline },
  searchingTitle: { color: COLORS.primary, fontSize: 28, fontFamily: FONTS.grotesk, marginTop: 20, letterSpacing: 2 },
  searchingSubtitle: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, marginTop: 10 },
  sectionHeader: { color: COLORS.primaryDim, fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  foundCount: { color: COLORS.warning, fontSize: 10, fontFamily: FONTS.monoBold },
  deviceCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.outline },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  deviceIcon: { width: 45, height: 45, backgroundColor: COLORS.surfaceHighest, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: COLORS.outline },
  deviceName: { color: COLORS.onSurface, fontSize: 16, fontFamily: FONTS.grotesk },
  readyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  readyText: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold },
  rssi: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.mono },
  connectBtn: { borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primaryContainer },
  connectBtnText: { color: COLORS.primary, fontSize: 12, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  protocolGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  protocolCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: COLORS.outline },
  protocolTitle: { color: COLORS.onSurfaceVariant, fontSize: 9, fontFamily: FONTS.monoBold, marginBottom: 15 },
  protocolFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  protocolValue: { color: COLORS.onSurface, fontSize: 12, fontFamily: FONTS.monoBold },
  simulateBtn: { marginTop: 20, backgroundColor: COLORS.surfaceHighest, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.outline, alignItems: 'center' },
  simulateBtnText: { color: COLORS.primary, fontSize: 14, fontFamily: FONTS.monoBold, letterSpacing: 1 },
});
