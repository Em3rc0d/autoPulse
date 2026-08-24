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
import { ReplayObdController } from '../../infrastructure/obd-replay/ReplayObdController';
import { RealTelemetryPoller } from '../../infrastructure/ble/real/RealTelemetryPoller';
import { TelemetryBlockRepository } from '../../infrastructure/database/product/repositories/TelemetryBlockRepository';
import { RealLiveSessionController } from '../../application/live/RealLiveSessionController';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import {
  commandResultContainsValidEcuSample,
  deriveLiveEcuTruth,
} from '../../application/live/LiveEcuTruth';

const screenWidth = Dimensions.get('window').width;

export default function LiveSessionScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId, sessionId, adapterMode, connectionHandleId, supportedPids, initialAdapterVoltage, replayUrl } = route.params || {};

  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId);

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [dataPoints, setDataPoints] = useState<number[]>([]); // For the graph
  const [hasValidEcuSample, setHasValidEcuSample] = useState(adapterMode !== 'REAL_BLE');
  const [firstEcuSampleAt, setFirstEcuSampleAt] = useState<number | null>(adapterMode !== 'REAL_BLE' ? Date.now() : null);

  const useGeneric = AppConfig.GENERIC_ADVISORY_PROFILES_ENABLED;

  // Usamos 1500ms como expected poll interval para evitar falsos STALE cuando el poller interroga muchos PIDs (ciclos de >1s)
  const rpmTracker = useSignalTracker('ENGINE_RPM', useGeneric ? DEMO_PROFILES.ENGINE_RPM : { ...DEMO_PROFILES.ENGINE_RPM, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const speedTracker = useSignalTracker('VEHICLE_SPEED', useGeneric ? DEMO_PROFILES.VEHICLE_SPEED : { ...DEMO_PROFILES.VEHICLE_SPEED, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const coolantTracker = useSignalTracker('ENGINE_COOLANT', useGeneric ? DEMO_PROFILES.ENGINE_COOLANT : { ...DEMO_PROFILES.ENGINE_COOLANT, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const ecuVoltageTracker = useSignalTracker('ECU_VOLTAGE', useGeneric ? DEMO_PROFILES.CONTROL_VOLTAGE : { ...DEMO_PROFILES.CONTROL_VOLTAGE, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const adapterVoltageTracker = useSignalTracker('ADAPTER_VOLTAGE', useGeneric ? DEMO_PROFILES.CONTROL_VOLTAGE : { ...DEMO_PROFILES.CONTROL_VOLTAGE, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);

  const [sessionController, setSessionController] = useState<RealLiveSessionController | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const productDb = useProductDb();
  const { context: localContext } = useLocalContext();

  const isStopping = React.useRef(false);

  useEffect(() => {
    if (initialAdapterVoltage && adapterVoltageTracker.value === null) {
      const match = String(initialAdapterVoltage).match(/(\d+(?:\.\d+)?)/);
      adapterVoltageTracker.update(match ? Number(match[1]) : null, match ? 'VALID' : 'UNAVAILABLE');
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

        // The foreground service describes the transport/session truth. It must
        // not claim that ECU telemetry is already flowing before the first sample.
        try {
          ReactNativeForegroundService.start({
            id: 1234,
            title: 'AutoPulse',
            message: 'OBD2 session active. Waiting for or reading vehicle data…',
            icon: 'ic_launcher',
            button: false,
            button2: false,
            setOnlyAlertOnce: 'true',
            color: '#000000',
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

      const voltagePrev = typeof adapterVoltageTracker.value === 'number' ? adapterVoltageTracker.value : 14.1;
      const drift = (Math.random() - 0.5) * 0.05;

      // Virtual is always running
      const virtualRpmCtx = { value: 800, quality: 'VALID' as any, observedAt: Date.now() };
      adapterVoltageTracker.update(Math.max(13.8, Math.min(14.4, voltagePrev + drift)), 'VALID', { rpm: virtualRpmCtx });
      ecuVoltageTracker.update(Math.max(13.7, Math.min(14.7, voltagePrev + drift)), 'VALID', { rpm: virtualRpmCtx });
    }, 500);
    return () => clearInterval(simulator);
  }, [adapterMode, dataPoints]);

  // Real Poller
  useEffect(() => {
    if (adapterMode !== 'REAL_BLE' || !localContext || !productDb) return;

    let controller = liveSessionRegistry.getController(sessionId);
    if (!controller) {
      const sessionRepo = new LiveSessionRepository(productDb);
      const telemetryRepo = new TelemetryBlockRepository(productDb);
      controller = new RealLiveSessionController(
        sessionRepo,
        telemetryRepo,
        localContext.defaultWorkspaceId,
        sessionId,
        connectionHandleId,
        supportedPids || []
      );
      liveSessionRegistry.registerController(sessionId, controller);
    }

    controller.start((result) => {
      if (commandResultContainsValidEcuSample(result)) {
        setHasValidEcuSample(true);
        setFirstEcuSampleAt(previous => previous ?? Date.now());
      }

      if (result.status === 'NO_DATA' || result.status === 'TIMEOUT' || result.status === 'INVALID_RESPONSE' || result.status === 'ELM_ERROR') {
        // Keep the last valid value visible while the tracker naturally moves to
        // STALE/DEGRADED. Transport failures are not vehicle non-support evidence.
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
        if (reading.type === 'ECU_VOLTAGE') ecuVoltageTracker.update(reading.value as number, 'VALID', { rpm: rpmCtx });
        if (reading.type === 'ADAPTER_VOLTAGE') adapterVoltageTracker.update(reading.value as number, 'VALID', { rpm: rpmCtx });
      }
    }, (error) => {
      setSessionError(error);
    });

    setSessionController(controller);

    return () => {
      // Don't kill it on unmount because we want it stable.
      // We will only cleanup when stop is pressed.
    };
  }, [adapterMode, connectionHandleId, supportedPids, localContext, productDb, sessionId]);

  // Laptop OBD replay over WebSocket.
  useEffect(() => {
    if (adapterMode !== 'REPLAY_WS' || !replayUrl) return;

    const controller = new ReplayObdController(replayUrl);
    const poller = new RealTelemetryPoller(controller, adapterMode === 'REPLAY_WS' ? ['010C', '010D', '0105', 'ATRV'] : (supportedPids || ['010C', '010D', '0105', '0142']), (result) => {
      const reading = result.status === 'SUCCESS_DECODED' ? result.decodedValues[0] : null;
      if (!reading) return;

      const speedCtx = speedTracker.getContextSnapshot();
      const rpmCtx = rpmTracker.getContextSnapshot();

      if (reading.value !== null) {
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
        if (reading.type === 'ECU_VOLTAGE') ecuVoltageTracker.update(reading.value as number, 'VALID', { rpm: rpmCtx });
        if (reading.type === 'ADAPTER_VOLTAGE') adapterVoltageTracker.update(reading.value as number, 'VALID', { rpm: rpmCtx });
      }
    });

    controller.connect()
      .then(() => poller.start(300))
      .catch((error) => {
        console.error('[OBD Replay] Connection failed', error);
      });

    return () => {
      poller.stop();
      controller.disconnect();
    };
  }, [adapterMode, replayUrl, supportedPids]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStop = async () => {
    if (isStopping.current) return; // Prevent double tap
    isStopping.current = true;

    if (sessionController) {
      await sessionController.stopSession();
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
      isVirtual: adapterMode !== 'REAL_BLE'
    });
  };

  const liveTruth = deriveLiveEcuTruth({
    hasValidEcuSample,
    elapsedMs: secondsElapsed * 1000,
    sessionError,
  });

  const liveTruthColor = liveTruth.tone === 'live'
    ? '#10b981'
    : liveTruth.tone === 'waiting'
      ? '#f59e0b'
      : liveTruth.tone === 'delayed'
        ? '#f97316'
        : '#ef4444';

  const waitingForFirstEcuSample = adapterMode === 'REAL_BLE' && !hasValidEcuSample;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Live Telemetry</Text>
          {vehicleLoading ? (
            <Text style={styles.subtitle}>Loading vehicle...</Text>
          ) : vehicle ? (
            <View>
              <Text style={styles.vehicleAlias}>{vehicle.alias}</Text>
              <Text style={styles.subtitle}>{vehicle.make} {vehicle.model} · {vehicle.year}</Text>
              <Text style={styles.technicalText}>
                {adapterMode === 'REAL_BLE'
                  ? `${hasValidEcuSample ? 'ECU observed' : 'ECU pending'} · Session ${sessionId?.substring(0, 8)}...`
                  : adapterMode === 'REPLAY_WS'
                    ? `Laptop replay · Session ${sessionId?.substring(0, 8)}...`
                    : `Virtual preview · Session ${sessionId?.substring(0, 8)}...`}
              </Text>
              {firstEcuSampleAt ? (
                <Text style={styles.firstSampleText}>First ECU sample received</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.subtitle}>Vehicle unavailable</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(secondsElapsed)}</Text>
          </View>

          {adapterMode === 'REAL_BLE' && AppConfig.INTERNAL_TOOLS_ENABLED && (
            <TouchableOpacity style={styles.diagButton} onPress={() => setShowDiagnostics(true)}>
              <Text style={styles.diagButtonText}>Logs</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {adapterMode === 'REAL_BLE' ? (
        <>
          <View style={[styles.badgeContainer, { backgroundColor: liveTruthColor }]}>
            <Text style={[styles.badgeText, liveTruth.tone === 'error' && styles.badgeTextLight]}>
              {liveTruth.label}
            </Text>
          </View>
          {liveTruth.state !== 'LIVE_ECU_DATA' ? (
            <View style={styles.statusDetailContainer}>
              <Text style={styles.statusDetailText}>{liveTruth.detail}</Text>
            </View>
          ) : null}
        </>
      ) : adapterMode === 'REPLAY_WS' ? (
        <View style={[styles.badgeContainer, { backgroundColor: '#60a5fa' }]}>
          <Text style={styles.badgeText}>LAPTOP · OBD RAW REPLAY</Text>
        </View>
      ) : (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>VIRTUAL · SIMULATED DATA / DEVELOPMENT ONLY</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
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
            label="ECU Voltage"
            value={ecuVoltageTracker.value}
            unit="V"
            state={ecuVoltageTracker.advisoryState}
            stats={ecuVoltageTracker.stats}
            profile={DEMO_PROFILES.CONTROL_VOLTAGE}
            origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'}
            testID="live-metric-card-ecu-voltage"
          />
          <LiveMetricCard
            label="Adapter Voltage"
            value={adapterVoltageTracker.value}
            unit="V"
            state={adapterVoltageTracker.advisoryState}
            stats={adapterVoltageTracker.stats}
            profile={DEMO_PROFILES.CONTROL_VOLTAGE}
            origin={adapterMode === 'REAL_BLE' ? 'Adapter measurement' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'}
            testID="live-metric-card-adapter-voltage"
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
              width={screenWidth - 32}
              height={180}
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
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                {waitingForFirstEcuSample
                  ? liveTruth.state === 'ECU_DATA_DELAYED'
                    ? 'ECU data is delayed. AutoPulse is still retrying…'
                    : 'Waiting for first ECU sample…'
                  : 'Waiting for RPM data…'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.stopButtonText}>Stop Session</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={AppConfig.INTERNAL_TOOLS_ENABLED && showDiagnostics} animationType="slide" presentationStyle="pageSheet">
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1a2227',
  },
  headerCopy: { flex: 1, paddingRight: 12 },
  headerActions: { alignItems: 'flex-end' },
  title: { color: '#fff', fontSize: 18, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  vehicleAlias: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: { color: '#9ca3af', fontSize: 12, fontFamily: 'Inter_400Regular' },
  technicalText: {
    color: '#4b5563',
    fontSize: 9,
    fontFamily: 'SpaceMono_400Regular',
    marginTop: 3,
  },
  firstSampleText: {
    color: '#10b981',
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 3,
  },
  timerContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  timerText: { color: '#ef4444', fontFamily: 'SpaceMono_700Bold', fontSize: 14 },
  diagButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  diagButtonText: {
    color: '#d1d5db',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeContainer: {
    backgroundColor: '#ca8a04',
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  badgeText: {
    color: '#0e1417',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  badgeTextLight: { color: '#fff' },
  statusDetailContainer: {
    backgroundColor: '#11191d',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3439',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusDetailText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Inter_400Regular',
  },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  contentContainer: { paddingBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chartTitle: { color: '#d1d5db', fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 10 },
  chartPlaceholder: { height: 180, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  chartPlaceholderText: { color: '#6b7280', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a2227',
    borderTopWidth: 1,
    borderTopColor: '#2a3439',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' }
});
