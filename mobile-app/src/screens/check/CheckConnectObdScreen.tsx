import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buildAdapterCapabilitySnapshot } from '../../domain/telemetry/probe/AdapterCapabilitySnapshot';
import { ProbeResult, ProbeVerdict } from '../../domain/telemetry/probe/ProbeResult';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { useBleManager } from '../../infrastructure/ble/BleManagerProvider';
import { BleCompatibilityProbe } from '../../infrastructure/ble/probe/BleCompatibilityProbe';
import { useAdapterDiscovery } from '../../infrastructure/ble/useAdapterDiscovery';
import { AdapterCapabilitySnapshotRepository } from '../../infrastructure/database/product/repositories/adapter-capability-snapshot.repository';
import { AdapterRepository } from '../../infrastructure/database/product/repositories/adapter.repository';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';

type UiState =
  | 'IDLE'
  | 'SEARCHING'
  | 'CONNECTING'
  | 'DISCOVERING_SERVICES'
  | 'INSPECTING_GATT'
  | 'TESTING_CHANNEL'
  | 'SUPPORTED'
  | 'UNKNOWN'
  | 'INCOMPATIBLE'
  | 'FAILED'
  | 'CANCELLED';

export default function CheckConnectObdScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const evaluationId = route.params?.evaluationId as string | undefined;
  const vehicleId = route.params?.vehicleId as string | undefined;
  const { vehicle } = useVehicle(vehicleId);
  const db = useProductDb();
  const { context } = useLocalContext();
  const { manager } = useBleManager();
  const { devices, isScanning, error: bleError, startScan, stopScan } = useAdapterDiscovery();

  const [uiState, setUiState] = useState<UiState>('IDLE');
  const [selectedDeviceName, setSelectedDeviceName] = useState('');
  const [probeResult, setProbeResult] = useState<{ result: ProbeResult; device?: any; handshakeComb?: any } | null>(null);
  const [activeProbe, setActiveProbe] = useState<BleCompatibilityProbe | null>(null);

  const start = () => {
    startScan();
    setUiState('SEARCHING');
  };

  const connect = async (deviceId: string, name: string) => {
    stopScan();
    setSelectedDeviceName(name);
    setUiState('CONNECTING');
    if (!manager) {
      setUiState('FAILED');
      return;
    }

    const probe = new BleCompatibilityProbe(manager, deviceId, stage => setUiState(stage as UiState));
    setActiveProbe(probe);
    const output = await probe.run();
    setProbeResult(output);

    switch (output.result.verdict) {
      case ProbeVerdict.SUPPORTED:
      case ProbeVerdict.SUPPORTED_WITH_PROFILE:
        setUiState('SUPPORTED');
        break;
      case ProbeVerdict.UNKNOWN:
        setUiState('UNKNOWN');
        break;
      case ProbeVerdict.INCOMPATIBLE_PROTOCOL:
      case ProbeVerdict.INCOMPATIBLE_TRANSPORT:
        setUiState('INCOMPATIBLE');
        break;
      case ProbeVerdict.CANCELLED:
        setUiState('CANCELLED');
        break;
      default:
        setUiState('FAILED');
    }
  };

  const cancel = () => {
    if (activeProbe) activeProbe.cancel();
    stopScan();
    setUiState('IDLE');
  };

  const useAdapter = async () => {
    if (!db || !context || !evaluationId || !vehicleId || !probeResult?.device || !probeResult.handshakeComb) {
      setUiState('FAILED');
      return;
    }

    try {
      const adapterRepo = new AdapterRepository(db);
      const capabilityRepo = new AdapterCapabilitySnapshotRepository(db);
      const adapter = await adapterRepo.upsertAdapter(context.defaultWorkspaceId, {
        alias: probeResult.device.name || 'Unknown OBD',
        platformDeviceId: probeResult.device.id,
        trustState: 'PROBED',
      });
      await capabilityRepo.append(
        context.defaultWorkspaceId,
        adapter.id,
        buildAdapterCapabilitySnapshot(probeResult.result),
      );

      const connectionHandleId = `check_${Math.random().toString(36).slice(2, 11)}`;
      activeBleController.retainConnection({
        connectionHandleId,
        device: probeResult.device,
        writeCharacteristic: probeResult.handshakeComb.writeCharacteristic,
        receiveCharacteristic: probeResult.handshakeComb.receiveCharacteristic,
        profileId: probeResult.result.matchedProfileId,
      });

      navigation.replace('CheckDiagnosticCapture', {
        evaluationId,
        vehicleId,
        connectionHandleId,
        adapterInstanceId: adapter.id,
      });
    } catch (error) {
      console.error('[AutoPulseCheck] Failed to retain diagnostic adapter:', error);
      setUiState('FAILED');
    }
  };

  const busy = ['CONNECTING', 'DISCOVERING_SERVICES', 'INSPECTING_GATT', 'TESTING_CHANNEL'].includes(uiState);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Evaluation</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>READ-ONLY DIAGNOSTICS</Text>
        <Text style={styles.title}>Connect adapter</Text>
        <Text style={styles.subtitle}>{vehicle?.alias ?? 'Vehicle'} · Check evidence capture</Text>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>No vehicle write commands</Text>
          <Text style={styles.safetyText}>This Check path reads diagnostic evidence only. It does not clear DTCs, reset ECUs, run actuators or program modules.</Text>
        </View>

        {uiState === 'IDLE' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.instruction}>Plug the adapter into the vehicle, switch ignition on, then scan.</Text>
            {bleError ? <Text style={styles.errorText}>{bleError}</Text> : null}
            <TouchableOpacity style={styles.primaryButton} onPress={start}>
              <Text style={styles.primaryButtonText}>Scan for adapters</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(uiState === 'SEARCHING' || isScanning) ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color="#d9ff3f" />
            <Text style={styles.statusText}>Searching…</Text>
            {devices.map(device => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceCard}
                onPress={() => connect(device.id, device.name || 'Unknown adapter')}
              >
                <Text style={styles.deviceName}>{device.name || 'Unknown adapter'}</Text>
                <Text style={styles.deviceMeta}>{device.id} · RSSI {device.rssi ?? '—'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.secondaryButton} onPress={cancel}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
          </View>
        ) : null}

        {busy ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.deviceName}>{selectedDeviceName}</Text>
            <Text style={styles.statusText}>{uiState.replace(/_/g, ' ').toLowerCase()}…</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={cancel}><Text style={styles.secondaryText}>Cancel probe</Text></TouchableOpacity>
          </View>
        ) : null}

        {uiState === 'SUPPORTED' ? (
          <View style={styles.centerBlock}>
            <View style={styles.successCircle}><Text style={styles.successIcon}>✓</Text></View>
            <Text style={styles.deviceName}>{selectedDeviceName}</Text>
            <Text style={styles.successText}>Adapter accepted for this Check</Text>
            <Text style={styles.probeText}>Compatibility: {probeResult?.result.compatibilityGrade}</Text>
            <Text style={styles.probeText}>Latency: {probeResult?.result.latencyMs ?? '—'} ms</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={useAdapter}>
              <Text style={styles.primaryButtonText}>Capture diagnostic evidence</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {uiState === 'UNKNOWN' || uiState === 'INCOMPATIBLE' || uiState === 'FAILED' || uiState === 'CANCELLED' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.errorTitle}>{uiState === 'UNKNOWN' ? 'Adapter not proven' : uiState.replace(/_/g, ' ')}</Text>
            <Text style={styles.instruction}>{probeResult?.result.failureReason ?? 'AutoPulse could not establish a trusted diagnostic channel.'}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setUiState('IDLE')}><Text style={styles.primaryButtonText}>Try again</Text></TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  eyebrow: { color: '#84cc16', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginTop: 10 },
  title: { color: '#f8fafc', fontSize: 31, fontWeight: '700', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 5 },
  safetyCard: { borderRadius: 15, borderWidth: 1, borderColor: '#365314', backgroundColor: '#141b11', padding: 14, marginTop: 20 },
  safetyTitle: { color: '#bef264', fontSize: 12, fontWeight: '900' },
  safetyText: { color: '#9baa8d', fontSize: 11, lineHeight: 17, marginTop: 5 },
  centerBlock: { alignItems: 'center', marginTop: 38 },
  instruction: { color: '#a6b2c2', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 320 },
  errorText: { color: '#f87171', fontSize: 11, marginTop: 10 },
  primaryButton: { width: '100%', minHeight: 56, borderRadius: 15, backgroundColor: '#d9ff3f', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryButtonText: { color: '#172000', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  secondaryText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  statusText: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  deviceCard: { width: '100%', borderRadius: 14, borderWidth: 1, borderColor: '#334155', backgroundColor: '#121b20', padding: 14, marginTop: 10 },
  deviceName: { color: '#f8fafc', fontSize: 15, fontWeight: '800', marginTop: 10 },
  deviceMeta: { color: '#64748b', fontSize: 9, marginTop: 5 },
  successCircle: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: '#84cc16', backgroundColor: 'rgba(132,204,22,0.10)', alignItems: 'center', justifyContent: 'center' },
  successIcon: { color: '#a3e635', fontSize: 32, fontWeight: '900' },
  successText: { color: '#4ade80', fontSize: 13, fontWeight: '800', marginTop: 7 },
  probeText: { color: '#64748b', fontSize: 10, marginTop: 6 },
  errorTitle: { color: '#f87171', fontSize: 17, fontWeight: '800', marginBottom: 8, textTransform: 'capitalize' },
});
