import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { useAdapterDiscovery } from '../../infrastructure/ble/useAdapterDiscovery';
import { useBleManager } from '../../infrastructure/ble/BleManagerProvider';
import { BleCompatibilityProbe } from '../../infrastructure/ble/probe/BleCompatibilityProbe';
import { ProbeResult, ProbeVerdict } from '../../domain/telemetry/probe/ProbeResult';
import { buildAdapterCapabilitySnapshot } from '../../domain/telemetry/probe/AdapterCapabilitySnapshot';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { AdapterRepository } from '../../infrastructure/database/product/repositories/adapter.repository';
import { AdapterCapabilitySnapshotRepository } from '../../infrastructure/database/product/repositories/adapter-capability-snapshot.repository';

type ProbeOutput = { result: ProbeResult; device?: any; handshakeComb?: any };
type UiState = 'IDLE' | 'SEARCHING' | 'PROBING' | 'SUPPORTED' | 'FAILED';

export default function CheckConnectObdScreen() {
  useKeepAwake();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const vehicleId = route.params?.vehicleId as string | undefined;
  const { vehicle } = useVehicle(vehicleId);
  const { manager } = useBleManager();
  const { devices, isScanning, error: discoveryError, startScan, stopScan } = useAdapterDiscovery();
  const db = useProductDb();
  const { context } = useLocalContext();

  const [uiState, setUiState] = useState<UiState>('IDLE');
  const [probeOutput, setProbeOutput] = useState<ProbeOutput | null>(null);
  const [activeProbe, setActiveProbe] = useState<BleCompatibilityProbe | null>(null);
  const [message, setMessage] = useState<string>('');

  const beginScan = () => {
    setMessage('');
    startScan();
    setUiState('SEARCHING');
  };

  const probeDevice = async (deviceId: string) => {
    stopScan();
    if (!manager) {
      setMessage('Bluetooth manager unavailable.');
      setUiState('FAILED');
      return;
    }
    setUiState('PROBING');
    const probe = new BleCompatibilityProbe(manager, deviceId, stage => setMessage(stage));
    setActiveProbe(probe);
    const output = await probe.run();
    setActiveProbe(null);
    setProbeOutput(output);
    if (output.result.verdict === ProbeVerdict.SUPPORTED || output.result.verdict === ProbeVerdict.SUPPORTED_WITH_PROFILE) {
      setUiState('SUPPORTED');
      setMessage('Read-only diagnostic channel available.');
      return;
    }
    setUiState('FAILED');
    setMessage(output.result.failureReason || `Adapter probe ended as ${output.result.verdict}.`);
  };

  const useForCheck = async () => {
    if (!vehicleId || !probeOutput?.device || !probeOutput.handshakeComb || !db || !context) {
      setMessage('Check connection context is incomplete.');
      setUiState('FAILED');
      return;
    }
    try {
      const adapterRepo = new AdapterRepository(db);
      const capabilityRepo = new AdapterCapabilitySnapshotRepository(db);
      const adapter = await adapterRepo.upsertAdapter(context.defaultWorkspaceId, {
        alias: probeOutput.device.name || 'Unknown OBD',
        platformDeviceId: probeOutput.device.id,
        trustState: 'PROBED',
      });
      await capabilityRepo.append(
        context.defaultWorkspaceId,
        adapter.id,
        buildAdapterCapabilitySnapshot(probeOutput.result),
      );

      const connectionHandleId = `check_${Math.random().toString(36).slice(2, 11)}`;
      activeBleController.retainConnection({
        connectionHandleId,
        device: probeOutput.device,
        writeCharacteristic: probeOutput.handshakeComb.writeCharacteristic,
        receiveCharacteristic: probeOutput.handshakeComb.receiveCharacteristic,
        profileId: probeOutput.result.matchedProfileId,
      });
      navigation.navigate('CheckRun', { vehicleId, connectionHandleId, adapterInstanceId: adapter.id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not retain the Check connection.');
      setUiState('FAILED');
    }
  };

  const cancel = () => {
    activeProbe?.cancel();
    stopScan();
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>← Check</Text>
        <Text style={styles.eyebrow}>PHYSICAL PILOT · READ ONLY</Text>
        <Text style={styles.title}>Connect OBD adapter</Text>
        <Text style={styles.subtitle}>{vehicle?.alias ?? 'Vehicle'} · connect only while the vehicle is parked.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Stationary use only</Text>
          <Text style={styles.noticeText}>Do not interact with AutoPulse while driving. This pilot never clears codes, resets modules or sends control commands.</Text>
        </View>

        {uiState === 'IDLE' && (
          <TouchableOpacity style={styles.primary} onPress={beginScan} testID="check-scan-adapters">
            <Text style={styles.primaryText}>Scan for adapters</Text>
          </TouchableOpacity>
        )}

        {(uiState === 'SEARCHING' || isScanning) && (
          <View style={styles.panel}>
            <ActivityIndicator color="#4ade80" />
            <Text style={styles.panelTitle}>Select your OBD adapter</Text>
            {devices.map(device => (
              <TouchableOpacity key={device.id} style={styles.device} onPress={() => void probeDevice(device.id)}>
                <Text style={styles.deviceName}>{device.name || 'Unknown device'}</Text>
                <Text style={styles.meta}>{device.id} · RSSI {device.rssi ?? '—'}</Text>
              </TouchableOpacity>
            ))}
            {discoveryError ? <Text style={styles.error}>{discoveryError}</Text> : null}
          </View>
        )}

        {uiState === 'PROBING' && (
          <View style={styles.panel}><ActivityIndicator color="#4ade80" /><Text style={styles.panelTitle}>Verifying adapter channel…</Text><Text style={styles.meta}>{message}</Text></View>
        )}

        {uiState === 'SUPPORTED' && (
          <View style={styles.panel}>
            <Text style={styles.good}>ADAPTER CHANNEL READY</Text>
            <Text style={styles.panelText}>{message}</Text>
            <TouchableOpacity style={styles.primary} onPress={() => void useForCheck()} testID="check-use-adapter">
              <Text style={styles.primaryText}>Continue to Check</Text>
            </TouchableOpacity>
          </View>
        )}

        {uiState === 'FAILED' && (
          <View style={styles.panel}>
            <Text style={styles.error}>CHECK CONNECTION BLOCKED</Text>
            <Text style={styles.panelText}>{message}</Text>
            <TouchableOpacity style={styles.secondary} onPress={beginScan}><Text style={styles.secondaryText}>Try another adapter</Text></TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.cancel} onPress={cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  back: { color: '#60a5fa', fontSize: 14, fontWeight: '800', marginBottom: 18 },
  eyebrow: { color: '#4ade80', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 7 },
  content: { padding: 18, paddingBottom: 48 },
  notice: { borderWidth: 1, borderColor: '#854d0e', backgroundColor: '#211a0c', borderRadius: 16, padding: 16, marginBottom: 18 },
  noticeTitle: { color: '#fbbf24', fontWeight: '900', fontSize: 15 },
  noticeText: { color: '#cbd5e1', marginTop: 7, lineHeight: 20 },
  panel: { backgroundColor: '#121b20', borderWidth: 1, borderColor: '#2a363d', borderRadius: 16, padding: 16, marginBottom: 16 },
  panelTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 17, marginTop: 10, marginBottom: 8 },
  panelText: { color: '#cbd5e1', lineHeight: 20, marginTop: 8 },
  device: { borderTopWidth: 1, borderTopColor: '#263139', paddingVertical: 14 },
  deviceName: { color: '#f8fafc', fontWeight: '800', fontSize: 15 },
  meta: { color: '#64748b', fontSize: 11, marginTop: 4 },
  good: { color: '#4ade80', fontWeight: '900', letterSpacing: 1 },
  error: { color: '#fca5a5', fontWeight: '800', marginTop: 8 },
  primary: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#475569', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  secondaryText: { color: '#e2e8f0', fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#94a3b8', fontWeight: '700' },
});
