import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAdapterDiscovery } from '../../infrastructure/ble/useAdapterDiscovery';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { BleCompatibilityProbe } from '../../infrastructure/ble/probe/BleCompatibilityProbe';
import { ProbeResult, ProbeVerdict } from '../../domain/telemetry/probe/ProbeResult';
import { buildAdapterCapabilitySnapshot } from '../../domain/telemetry/probe/AdapterCapabilitySnapshot';
import { useBleManager } from '../../infrastructure/ble/BleManagerProvider';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { AdapterRepository } from '../../infrastructure/database/product/repositories/adapter.repository';
import { AdapterCapabilitySnapshotRepository } from '../../infrastructure/database/product/repositories/adapter-capability-snapshot.repository';

const INTERNAL_VIRTUAL_OBD_ENABLED = true; // Feature flag for testing

type ProbeUiState =
  | 'IDLE' | 'SEARCHING' | 'DEVICE_SELECTED' | 'CONNECTING'
  | 'DISCOVERING_SERVICES' | 'INSPECTING_GATT' | 'TESTING_CHANNEL'
  | 'SUPPORTED' | 'UNKNOWN' | 'INCOMPATIBLE' | 'FAILED' | 'CANCELLED';

import { useKeepAwake } from 'expo-keep-awake';

export default function ConnectObdScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const vehicleId = route.params?.vehicleId;

  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId);

  const productDb = useProductDb();
  const { context: localContext, loading: contextLoading } = useLocalContext();

  const { manager } = useBleManager();
  const { devices, isScanning, error: bleError, startScan, stopScan, bluetoothState } = useAdapterDiscovery();

  const [uiState, setUiState] = useState<ProbeUiState>('IDLE');
  const [probeStageStr, setProbeStageStr] = useState<string>('');
  const [probeResult, setProbeResult] = useState<{ result: ProbeResult, device?: any, handshakeComb?: any } | null>(null);
  const [activeProbe, setActiveProbe] = useState<BleCompatibilityProbe | null>(null);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>('');
  const [replayHost, setReplayHost] = useState<string>('127.0.0.1');

  const handleStartScan = () => {
    startScan();
    setUiState('SEARCHING');
  };

  const connectToDevice = async (deviceId: string, name: string) => {
    stopScan();
    setSelectedDeviceName(name);
    setUiState('CONNECTING');

    if (!manager) {
      setUiState('FAILED');
      return;
    }

    const probe = new BleCompatibilityProbe(manager, deviceId, (stage) => {
      setUiState(stage as ProbeUiState);
      setProbeStageStr(stage);
    });

    setActiveProbe(probe);

    const probeOutput = await probe.run();
    setProbeResult(probeOutput);

    switch (probeOutput.result.verdict) {
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

  const handleCancel = () => {
    if (activeProbe) {
      activeProbe.cancel();
    } else {
      stopScan();
      setUiState('IDLE');
    }
  };

  const confirmAndUseAdapter = async () => {
    if (!probeResult || !probeResult.device || !probeResult.handshakeComb) {
      setUiState('FAILED');
      return;
    }

    if (!localContext || !productDb) {
      setUiState('FAILED');
      console.error('LOCAL_CONTEXT_UNAVAILABLE');
      return;
    }

    try {
      const adapterRepo = new AdapterRepository(productDb);
      const capabilityRepo = new AdapterCapabilitySnapshotRepository(productDb);
      const sessionRepo = new LiveSessionRepository(productDb);

      const adapter = await adapterRepo.upsertAdapter(localContext.defaultWorkspaceId, {
        alias: probeResult.device.name || 'Unknown OBD',
        platformDeviceId: probeResult.device.id,
        trustState: 'PROBED'
      });

      // Release invariant: a real Live session may not start from an accepted
      // adapter unless the evidence that justified acceptance is persisted first.
      const capabilitySnapshot = buildAdapterCapabilitySnapshot(probeResult.result);
      await capabilityRepo.append(
        localContext.defaultWorkspaceId,
        adapter.id,
        capabilitySnapshot,
      );

      const sessionId = await sessionRepo.createSession(
        localContext.defaultWorkspaceId,
        vehicleId,
        localContext.defaultOperatorId,
        adapter.id
      );

      const connectionHandleId = `conn_${Math.random().toString(36).substr(2, 9)}`;

      activeBleController.retainConnection({
        connectionHandleId,
        device: probeResult.device,
        writeCharacteristic: probeResult.handshakeComb.writeCharacteristic,
        receiveCharacteristic: probeResult.handshakeComb.receiveCharacteristic,
        profileId: probeResult.result.matchedProfileId,
      });

      navigation.navigate('Initialization', {
        vehicleId,
        sessionId,
        connectionHandleId,
        adapterMode: 'REAL_BLE',
        adapterInstanceId: adapter.id
      });
    } catch (err) {
      console.error('Error creating live session:', err);
      setUiState('FAILED');
    }
  };

  const startVirtualConnection = () => {
    const virtualSessionId = `virt_${Math.random().toString(36).substr(2, 9)}`;

    navigation.navigate('Initialization', {
      vehicleId,
      sessionId: virtualSessionId,
      adapterMode: 'VIRTUAL_PREVIEW'
    });
  };

  const startLaptopReplay = () => {
    const replaySessionId = `replay_${Math.random().toString(36).substr(2, 9)}`;
    const cleanHost = replayHost.trim().replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
    navigation.navigate('LiveSession', {
      vehicleId,
      sessionId: replaySessionId,
      adapterMode: 'REPLAY_WS',
      replayUrl: `http://${cleanHost}:8765`,
      supportedPids: ['010C', '010D', '0105', '0142'],
      initialAdapterVoltage: '13.8V'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OBD2 Connection</Text>
        {vehicleLoading || contextLoading ? (
          <Text style={styles.subtitle}>Loading context...</Text>
        ) : vehicle && localContext ? (
          <View>
            <Text style={styles.vehicleAlias}>{vehicle.alias}</Text>
            <Text style={styles.subtitle}>{vehicle.make} {vehicle.model} · {vehicle.year}</Text>
            <Text style={styles.technicalText}>{vehicleId ? vehicleId.substring(0, 8) : 'No vehicle'}... | W: {localContext.defaultWorkspaceId.substring(0,8)}</Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>Context unavailable</Text>
        )}
      </View>

      <View style={styles.content}>
        {!localContext && !contextLoading && (
           <View style={styles.stateContainer}>
             <Text style={styles.errorText}>LOCAL_CONTEXT_UNAVAILABLE</Text>
             <Text style={styles.instruction}>The app context could not be loaded. Database might be corrupt.</Text>
           </View>
        )}

        {localContext && uiState === 'IDLE' && (
          <View style={styles.stateContainer}>
            <Text style={styles.instruction}>Plug the adapter into the OBD2 port and turn on the ignition.</Text>

            {bleError && <Text style={styles.errorText}>{bleError}</Text>}

            <TouchableOpacity style={styles.primaryButton} onPress={handleStartScan}>
              <Text style={styles.primaryButtonText}>Scan for Adapters</Text>
            </TouchableOpacity>

            {INTERNAL_VIRTUAL_OBD_ENABLED && (
              <>
                <TouchableOpacity style={styles.secondaryButton} onPress={startVirtualConnection}>
                  <Text style={styles.secondaryButtonText}>Use Virtual Adapter (Dev)</Text>
                </TouchableOpacity>

                <View style={styles.replayBox}>
                  <Text style={styles.replayLabel}>LAPTOP REPLAY HOST</Text>
                  <TextInput
                    style={styles.replayInput}
                    value={replayHost}
                    onChangeText={setReplayHost}
                    placeholder="127.0.0.1"
                    placeholderTextColor="#4b5563"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity style={styles.secondaryButton} onPress={startLaptopReplay}>
                    <Text style={styles.secondaryButtonText}>Connect to Laptop Replay</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {(uiState === 'SEARCHING' || isScanning) && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.statusText}>Searching for OBD2 devices...</Text>

            <View style={styles.deviceList}>
              {devices.map((d) => (
                <TouchableOpacity key={d.id} style={styles.deviceCard} onPress={() => connectToDevice(d.id, d.name || 'Unknown Device')}>
                  <Text style={styles.deviceName}>{d.name || 'Unknown Device'}</Text>
                  <Text style={styles.deviceInfo}>{d.id} | RSSI: {d.rssi}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {(uiState === 'CONNECTING' || uiState === 'DISCOVERING_SERVICES' || uiState === 'INSPECTING_GATT' || uiState === 'TESTING_CHANNEL') && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.deviceName}>{selectedDeviceName}</Text>
            <Text style={styles.statusText}>
              {uiState === 'CONNECTING' ? 'Connecting to device...' :
               uiState === 'DISCOVERING_SERVICES' ? 'Discovering services...' :
               uiState === 'INSPECTING_GATT' ? 'Inspecting GATT characteristics...' :
               'Testing OBD2 channels...'}
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
              <Text style={styles.secondaryButtonText}>Cancel Probe</Text>
            </TouchableOpacity>
          </View>
        )}

        {uiState === 'SUPPORTED' && (
          <View style={styles.stateContainer}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.deviceName}>{selectedDeviceName}</Text>
            <Text style={styles.statusTextSuccess}>Adapter Compatible</Text>

            <View style={styles.probeSummary}>
              <Text style={styles.probeText}>Compatibility: {probeResult?.result.compatibilityGrade}</Text>
              <Text style={styles.probeText}>Profile: {probeResult?.result.matchedProfileId || probeResult?.result.profileMatch}</Text>
              <Text style={styles.probeText}>Handshake: {probeResult?.result.commandUsed?.trim()} ➔ {probeResult?.result.sanitizedResponse || 'OK'}</Text>
              <Text style={styles.probeText}>Latency: {probeResult?.result.latencyMs}ms</Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={confirmAndUseAdapter}>
              <Text style={styles.primaryButtonText}>Use this adapter</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setUiState('IDLE')}>
              <Text style={styles.secondaryButtonText}>Choose another</Text>
            </TouchableOpacity>
          </View>
        )}

        {uiState === 'UNKNOWN' && (
          <View style={styles.stateContainer}>
            <View style={[styles.successCircle, { borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
              <Text style={[styles.successIcon, { color: '#eab308' }]}>?</Text>
            </View>
            <Text style={styles.deviceName}>{selectedDeviceName}</Text>
            <Text style={[styles.statusTextSuccess, { color: '#eab308' }]}>Unknown Device</Text>
            <Text style={styles.instruction}>The device connects, but did not respond to standard OBD2 initialization.</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => connectToDevice(probeResult?.result.deviceId || '', selectedDeviceName)}>
              <Text style={styles.primaryButtonText}>Retry compatibility test</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setUiState('IDLE')}>
              <Text style={styles.secondaryButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        )}

        {(uiState === 'INCOMPATIBLE' || uiState === 'FAILED' || uiState === 'CANCELLED') && (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>
              {uiState === 'CANCELLED' ? 'Probe Cancelled' : uiState === 'INCOMPATIBLE' ? 'Incompatible Device' : 'Probe Failed'}
            </Text>
            <Text style={styles.instruction}>
              {probeResult?.result.failureReason || 'Ensure the adapter is an ELM327 BLE compatible device.'}
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setUiState('IDLE')}>
              <Text style={styles.primaryButtonText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1417',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#1a2227',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3439',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
  },
  vehicleAlias: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  technicalText: {
    color: '#4b5563',
    fontSize: 11,
    fontFamily: 'SpaceMono_400Regular',
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateContainer: {
    alignItems: 'center',
    width: '100%',
  },
  instruction: {
    color: '#d1d5db',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    marginTop: 24,
  },
  statusTextSuccess: {
    color: '#4ade80',
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 24,
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  secondaryButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4ade80',
  },
  successIcon: {
    color: '#4ade80',
    fontSize: 40,
    fontWeight: 'bold',
  },
  probeSummary: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  probeText: {
    color: '#d1d5db',
    fontSize: 14,
    fontFamily: 'SpaceMono_400Regular',
    marginBottom: 4,
  },
  deviceList: {
    width: '100%',
    marginTop: 24,
  },
  deviceCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  deviceName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  deviceInfo: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  replayBox: {
    width: '100%',
    marginTop: 16,
  },
  replayLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  replayInput: {
    width: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    color: '#f9fafb',
    fontSize: 15,
    fontFamily: 'SpaceMono_400Regular',
    paddingHorizontal: 14,
    paddingVertical: 12,
  }
});