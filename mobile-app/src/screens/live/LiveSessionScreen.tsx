import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, PermissionsAndroid, Platform } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import { useKeepAwake } from 'expo-keep-awake';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { LiveMetricCard } from './components/LiveMetricCard';
import { DEMO_PROFILES } from '../../domain/telemetry/SignalProfiles';
import { liveSessionRegistry } from '../../application/live/LiveSessionRegistry';
import { useSignalTracker } from './components/useSignalTracker';
import { AppConfig } from '../../application/config';
import { DiagnosticsLogScreen } from './DiagnosticsLogScreen';
import { TelemetryBlockRepository } from '../../infrastructure/database/product/repositories/TelemetryBlockRepository';
import { LiveSessionCoordinator } from '../../application/live/LiveSessionCoordinator';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { BleRawTransport } from '../../infrastructure/ble/real/BleRawTransport';
import { ReplayRawTransport } from '../../infrastructure/obd-replay/ReplayRawTransport';
import { ObdCommandProcessor } from '../../infrastructure/ble/real/ObdCommandProcessor';
import { ObdSessionLease } from '../../application/live/ports/ObdCommandExecutor';

const screenWidth = Dimensions.get('window').width;

export default function LiveSessionScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId, sessionId, adapterMode, connectionHandleId, supportedPids, initialAdapterVoltage, replayUrl } = route.params || {};

  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId);

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [dataPoints, setDataPoints] = useState<number[]>([]); 

  const useGeneric = AppConfig.GENERIC_ADVISORY_PROFILES_ENABLED;

  const rpmTracker = useSignalTracker('ENGINE_RPM', useGeneric ? DEMO_PROFILES.ENGINE_RPM : { ...DEMO_PROFILES.ENGINE_RPM, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const speedTracker = useSignalTracker('VEHICLE_SPEED', useGeneric ? DEMO_PROFILES.VEHICLE_SPEED : { ...DEMO_PROFILES.VEHICLE_SPEED, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const coolantTracker = useSignalTracker('ENGINE_COOLANT', useGeneric ? DEMO_PROFILES.ENGINE_COOLANT : { ...DEMO_PROFILES.ENGINE_COOLANT, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const voltageTracker = useSignalTracker('CONTROL_VOLTAGE', useGeneric ? DEMO_PROFILES.CONTROL_VOLTAGE : { ...DEMO_PROFILES.CONTROL_VOLTAGE, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);

  const [sessionCoordinator, setSessionCoordinator] = useState<LiveSessionCoordinator | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const productDb = useProductDb();
  const { context: localContext } = useLocalContext();

  const isStopping = React.useRef(false);
  const coordinatorStarted = React.useRef(false);

  useEffect(() => {
    if (initialAdapterVoltage && voltageTracker.value === null) {
      const match = String(initialAdapterVoltage).match(/(\d+(?:\.\d+)?)/);
      voltageTracker.update(match ? Number(match[1]) : null, match ? 'VALID' : 'UNAVAILABLE');
    }
  }, [initialAdapterVoltage]);

  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS === 'android') {
        const permsToRequest = [];
        if (Platform.Version >= 33) {
          permsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        if (Platform.Version >= 31) {
          permsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        }

        if (permsToRequest.length > 0) {
          try {
            await PermissionsAndroid.requestMultiple(permsToRequest);
          } catch (err) {
            console.warn('Failed to request permissions', err);
          }
        }

        try {
          ReactNativeForegroundService.start({
            id: 1234,
            title: "AutoPulse",
            message: "Conexión OBD2 activa leyendo telemetría...",
            icon: "ic_launcher",
            button: false,
            button2: false,
            setOnlyAlertOnce: "true",
            color: "#000000",
          });
        } catch (err) {
          console.warn('Failed to start foreground service', err);
        }
      }
    }
    requestPermissions();

    return () => {
      if (Platform.OS === 'android') {
        ReactNativeForegroundService.stopAll();
      }
    };
  }, []);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Virtual Simulator
  useEffect(() => {
    if (adapterMode !== 'VIRTUAL_PREVIEW') return;

    if (dataPoints.length === 0) {
       setDataPoints([800]);
    }

    const simulator = setInterval(() => {
      setDataPoints(prev => {
        const lastVal = prev.length > 0 ? prev[prev.length - 1] : 800;
        const drift = (Math.random() - 0.45) * 80;
        const nextVal = Math.max(800, Math.min(6500, lastVal + drift));
        const newPoints = [...prev, nextVal];
        if (newPoints.length > 20) newPoints.shift();
      const speedCtx = { value: speedTracker.value, quality: speedTracker.advisoryState.quality, observedAt: speedTracker.lastUpdateAt };
      const rpmCtx = { value: rpmTracker.value, quality: rpmTracker.advisoryState.quality, observedAt: rpmTracker.lastUpdateAt };

      rpmTracker.update(nextVal, 'VALID', { speed: speedCtx });
      return newPoints;
    });

    const numPrev = typeof speedTracker.value === 'number' ? speedTracker.value : 0;
    const lastRpm = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : 800;
    const targetSpeed = (lastRpm / 6500) * 120;
    const diff = targetSpeed - numPrev;
    speedTracker.update(Math.max(0, numPrev + (diff * 0.1) + (Math.random() - 0.5)), 'VALID');

    const coolantPrev = typeof coolantTracker.value === 'number' ? coolantTracker.value : 90;
    coolantTracker.update(Math.min(105, coolantPrev + (Math.random() * 0.05)), 'VALID');

    const voltagePrev = typeof voltageTracker.value === 'number' ? voltageTracker.value : 14.1;
    const drift = (Math.random() - 0.5) * 0.05;

    const virtualRpmCtx = { value: 800, quality: 'VALID' as any, observedAt: Date.now() };
    voltageTracker.update(Math.max(13.8, Math.min(14.4, voltagePrev + drift)), 'VALID', { rpm: virtualRpmCtx });
    }, 500);
    return () => clearInterval(simulator);
  }, [adapterMode, dataPoints]);

  // Real or Replay Coordinator
  useEffect(() => {
    if ((adapterMode !== 'REAL_BLE' && adapterMode !== 'REPLAY_WS') || !localContext || !productDb) return;
    if (coordinatorStarted.current) return;
    coordinatorStarted.current = true;

    let coordinator = liveSessionRegistry.getController(sessionId) as LiveSessionCoordinator;
    if (!coordinator) {
      const sessionRepo = new LiveSessionRepository(productDb);
      const telemetryRepo = new TelemetryBlockRepository(productDb);
      coordinator = new LiveSessionCoordinator(
        sessionRepo,
        telemetryRepo,
        localContext.defaultWorkspaceId,
        sessionId,
        supportedPids || []
      );
      liveSessionRegistry.registerController(sessionId, coordinator);
    }

    setSessionCoordinator(coordinator);

    const setupLeaseAndStart = async () => {
      try {
        let lease: ObdSessionLease;

        if (adapterMode === 'REAL_BLE') {
          const conn = activeBleController.getConnection(connectionHandleId);
          if (!conn) throw new Error('CONNECTION_LOST');
          
          const transport = new BleRawTransport(conn);
          const executor = new ObdCommandProcessor(transport);

          lease = {
            executor,
            sourceType: 'REAL_BLE',
            release: async () => {
              transport.disconnect();
              activeBleController.releaseConnection();
            }
          };
        } else {
          // REPLAY_WS
          const transport = new ReplayRawTransport(replayUrl);
          await transport.connect();
          const executor = new ObdCommandProcessor(transport);

          lease = {
            executor,
            sourceType: 'LAPTOP_REPLAY',
            release: async () => {
              transport.disconnect();
            }
          };
        }

        await coordinator.start(
          lease,
          (result) => {
            if (result.status === 'NO_DATA' || result.status === 'TIMEOUT' || result.status === 'INVALID_RESPONSE' || result.status === 'ELM_ERROR') {
               return;
            }

            const reading = result.status === 'SUCCESS_DECODED' ? result.decodedValues[0] : null;
            if (reading && reading.value !== null) {
              const speedCtx = speedTracker.getContextSnapshot();
              const rpmCtx = rpmTracker.getContextSnapshot();

              if (reading.type === 'RPM') {
                setDataPoints(prev => {
                  const newPoints = [...prev, reading.value as number];
                  if (newPoints.length > 20) newPoints.shift();
                  return newPoints;
                });
                rpmTracker.update(reading.value as number, 'VALID', { speed: speedCtx });
              }
              if (reading.type === 'SPEED') speedTracker.update(reading.value as number, 'VALID');
              if (reading.type === 'COOLANT') coolantTracker.update(reading.value as number, 'VALID');
              if (reading.type === 'VOLTAGE') voltageTracker.update(reading.value as number, 'VALID', { rpm: rpmCtx });
            }
          },
          (err) => {
            setSessionError(err);
          }
        );
      } catch (err: any) {
        setSessionError(err.message || 'Failed to start session');
      }
    };

    setupLeaseAndStart();

  }, [adapterMode, connectionHandleId, supportedPids, replayUrl, localContext, productDb]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStop = async () => {
    if (isStopping.current) return;
    isStopping.current = true;

    if (sessionCoordinator) {
      await sessionCoordinator.stopSession();
      liveSessionRegistry.unregisterController(sessionId);
    } else {
      if (typeof activeBleController !== 'undefined') {
        activeBleController.releaseConnection();
      }
    }

    navigation.navigate('SessionSummary', {
      vehicleId,
      sessionId,
      duration: secondsElapsed,
      isVirtual: adapterMode !== 'REAL_BLE' && adapterMode !== 'REPLAY_WS'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Telemetry</Text>
          {vehicleLoading ? (
            <Text style={styles.subtitle}>Loading vehicle...</Text>
          ) : vehicle ? (
            <View>
              <Text style={styles.vehicleAlias}>{vehicle.alias}</Text>
              <Text style={styles.subtitle}>{vehicle.make} {vehicle.model} · {vehicle.year}</Text>
              <Text style={styles.technicalText}>
                {adapterMode === 'REAL_BLE' ? `ECU Direct · Session ${sessionId?.substring(0, 8)}...` : adapterMode === 'REPLAY_WS' ? `Laptop replay · Session ${sessionId?.substring(0, 8)}...` : `Virtual preview · Session ${sessionId?.substring(0, 8)}...`}
              </Text>
            </View>
          ) : (
            <Text style={styles.subtitle}>Vehicle unavailable</Text>
          )}
        </View>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(secondsElapsed)}</Text>
        </View>

        {(adapterMode === 'REAL_BLE' || adapterMode === 'REPLAY_WS') && (
          <TouchableOpacity style={styles.diagButton} onPress={() => setShowDiagnostics(true)}>
            <Text style={styles.diagButtonText}>Logs</Text>
          </TouchableOpacity>
        )}
      </View>

      {adapterMode === 'REAL_BLE' ? (
        <View style={[styles.badgeContainer, { backgroundColor: sessionError ? '#ef4444' : '#10b981' }]}>
          <Text style={styles.badgeText}>
            {sessionError ? `RECORDING FAILED: ${sessionError}` : 'LIVE · ECU DATA'}
          </Text>
        </View>
      ) : adapterMode === 'REPLAY_WS' ? (
        <View style={[styles.badgeContainer, { backgroundColor: sessionError ? '#ef4444' : '#60a5fa' }]}>
          <Text style={styles.badgeText}>
            {sessionError ? `RECORDING FAILED: ${sessionError}` : 'LAPTOP · OBD RAW REPLAY'}
          </Text>
        </View>
      ) : (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>VIRTUAL · SIMULATED DATA / DEVELOPMENT ONLY</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.grid}>
          <LiveMetricCard
            label="Engine RPM"
            value={rpmTracker.value}
            unit="rpm"
            state={rpmTracker.advisoryState}
            stats={rpmTracker.stats}
            profile={DEMO_PROFILES.ENGINE_RPM}
            origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'}
            testID="live-metric-card-engine-rpm"
          />
          <LiveMetricCard
            label="Vehicle Speed"
            value={speedTracker.value}
            unit="km/h"
            state={speedTracker.advisoryState}
            stats={speedTracker.stats}
            profile={DEMO_PROFILES.VEHICLE_SPEED}
            origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'}
            testID="live-metric-card-vehicle-speed"
          />
          <LiveMetricCard
            label="Engine Coolant"
            value={coolantTracker.value}
            unit="°C"
            state={coolantTracker.advisoryState}
            stats={coolantTracker.stats}
            profile={DEMO_PROFILES.ENGINE_COOLANT}
            origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'}
            testID="live-metric-card-engine-coolant"
          />
          <LiveMetricCard
            label="Control Voltage"
            value={voltageTracker.value}
            unit="V"
            state={voltageTracker.advisoryState}
            stats={voltageTracker.stats}
            profile={DEMO_PROFILES.CONTROL_VOLTAGE}
            origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'}
            testID="live-metric-card-control-voltage"
          />
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>RPM History</Text>
          {dataPoints.length > 0 ? (
            <LineChart
              data={{
                labels: [],
                datasets: [{ data: dataPoints }]
              }}
              width={screenWidth - 48}
              height={220}
              chartConfig={{
                backgroundColor: '#1f2937',
                backgroundGradientFrom: '#1f2937',
                backgroundGradientTo: '#1f2937',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '3', strokeWidth: '1', stroke: '#4ade80' }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 12 }}
            />
          ) : (
            <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontFamily: 'Inter_500Medium' }}>Waiting for RPM data...</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.stopButtonText}>Stop Session</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDiagnostics} animationType="slide" presentationStyle="pageSheet">
        <DiagnosticsLogScreen onClose={() => setShowDiagnostics(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1417' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#1a2227',
  },
  title: { color: '#fff', fontSize: 20, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  vehicleAlias: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: { color: '#9ca3af', fontSize: 13, fontFamily: 'Inter_400Regular' },
  technicalText: {
    color: '#4b5563',
    fontSize: 10,
    fontFamily: 'SpaceMono_400Regular',
    marginTop: 4,
  },
  timerContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  timerText: { color: '#ef4444', fontFamily: 'SpaceMono_700Bold', fontSize: 16 },
  diagButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  diagButtonText: {
    color: '#d1d5db',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeContainer: {
    backgroundColor: '#ca8a04',
    paddingVertical: 4,
    alignItems: 'center',
  },
  badgeText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  content: { flex: 1, padding: 24 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    width: '48%',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardLabel: { color: '#9ca3af', fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  cardValue: { color: '#fff', fontSize: 24, fontFamily: 'SpaceMono_700Bold' },
  originText: { color: '#6b7280', fontSize: 10, fontFamily: 'SpaceMono_400Regular', marginTop: 4 },
  chartContainer: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chartTitle: { color: '#d1d5db', fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 16 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: '#1a2227',
    borderTopWidth: 1,
    borderTopColor: '#2a3439',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopButtonText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' }
});
