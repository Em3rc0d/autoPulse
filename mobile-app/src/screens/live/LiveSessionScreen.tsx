import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { LiveMetricCard } from './components/LiveMetricCard';
import { DEMO_PROFILES } from '../../domain/telemetry/SignalProfiles';
import { liveSessionRegistry } from '../../application/live/LiveSessionRegistry';
import {
  parseInitialAdapterVoltage,
  routeLiveDecodedValues,
} from '../../application/live/LiveDecodedSignalRouter';
import { useSignalTracker } from './components/useSignalTracker';
import { AppConfig } from '../../application/config';
import { DiagnosticsLogScreen } from './DiagnosticsLogScreen';
import { ReplayObdController } from '../../infrastructure/obd-replay/ReplayObdController';
import { RealTelemetryPoller } from '../../infrastructure/ble/real/RealTelemetryPoller';
import { TelemetryBlockRepository } from '../../infrastructure/database/product/repositories/TelemetryBlockRepository';
import {
  RealLiveSessionController,
  type LiveSessionTerminalOutcome,
} from '../../application/live/RealLiveSessionController';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import {
  commandResultContainsValidEcuSample,
  deriveLiveEcuTruth,
} from '../../application/live/LiveEcuTruth';
import { speakDriverMessage } from '../../infrastructure/voice/AndroidDriverVoice';

const screenWidth = Dimensions.get('window').width;

interface Props {
  supplement?: React.ReactNode;
  onTerminalStateChange?: (outcome: LiveSessionTerminalOutcome | null) => void;
}

export default function LiveSessionScreen({ supplement, onTerminalStateChange }: Props = {}) {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId, sessionId, adapterMode, connectionHandleId, supportedPids, initialAdapterVoltage, replayUrl } = route.params || {};
  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId);

  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [dataPoints, setDataPoints] = useState<number[]>([]);
  const [hasValidEcuSample, setHasValidEcuSample] = useState(adapterMode !== 'REAL_BLE');
  const [firstEcuSampleAt, setFirstEcuSampleAt] = useState<number | null>(adapterMode !== 'REAL_BLE' ? Date.now() : null);
  const [sessionController, setSessionController] = useState<RealLiveSessionController | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [terminalOutcome, setTerminalOutcome] = useState<LiveSessionTerminalOutcome | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const useGeneric = AppConfig.GENERIC_ADVISORY_PROFILES_ENABLED;
  const rpmTracker = useSignalTracker('ENGINE_RPM', useGeneric ? DEMO_PROFILES.ENGINE_RPM : { ...DEMO_PROFILES.ENGINE_RPM, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const speedTracker = useSignalTracker('VEHICLE_SPEED', useGeneric ? DEMO_PROFILES.VEHICLE_SPEED : { ...DEMO_PROFILES.VEHICLE_SPEED, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const coolantTracker = useSignalTracker('ENGINE_COOLANT', useGeneric ? DEMO_PROFILES.ENGINE_COOLANT : { ...DEMO_PROFILES.ENGINE_COOLANT, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const loadTracker = useSignalTracker('ENGINE_LOAD', useGeneric ? DEMO_PROFILES.ENGINE_LOAD : { ...DEMO_PROFILES.ENGINE_LOAD, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const throttleTracker = useSignalTracker('THROTTLE_POSITION', useGeneric ? DEMO_PROFILES.THROTTLE_POSITION : { ...DEMO_PROFILES.THROTTLE_POSITION, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const ecuVoltageTracker = useSignalTracker('ECU_VOLTAGE', useGeneric ? DEMO_PROFILES.CONTROL_VOLTAGE : { ...DEMO_PROFILES.CONTROL_VOLTAGE, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);
  const adapterVoltageTracker = useSignalTracker('ADAPTER_VOLTAGE', useGeneric ? DEMO_PROFILES.CONTROL_VOLTAGE : { ...DEMO_PROFILES.CONTROL_VOLTAGE, bands: [], calibrationStatus: 'NOT_CALIBRATED' }, 1500);

  const productDb = useProductDb();
  const { context: localContext } = useLocalContext();
  const isStopping = React.useRef(false);
  const initialAdapterVoltageValue = parseInitialAdapterVoltage(initialAdapterVoltage);

  const applyDecodedValues = (decodedValues: readonly { type: string; value: unknown; unit?: string }[] | null | undefined) => {
    const readings = routeLiveDecodedValues(decodedValues);
    if (readings.length === 0) return;

    const speedCtx = speedTracker.getContextSnapshot();
    const rpmCtx = rpmTracker.getContextSnapshot();

    readings.forEach(reading => {
      switch (reading.signalId) {
        case 'ENGINE_RPM':
          setDataPoints(prev => {
            const next = [...prev, reading.value];
            if (next.length > 20) next.shift();
            return next;
          });
          rpmTracker.update(reading.value, 'VALID', { speed: speedCtx });
          break;
        case 'VEHICLE_SPEED':
          speedTracker.update(reading.value, 'VALID');
          break;
        case 'ENGINE_COOLANT':
          coolantTracker.update(reading.value, 'VALID');
          break;
        case 'ENGINE_LOAD':
          loadTracker.update(reading.value, 'VALID');
          break;
        case 'THROTTLE_POSITION':
          throttleTracker.update(reading.value, 'VALID');
          break;
        case 'CONTROL_VOLTAGE':
          ecuVoltageTracker.update(reading.value, 'VALID', { rpm: rpmCtx });
          break;
        case 'ADAPTER_VOLTAGE':
          adapterVoltageTracker.update(reading.value, 'VALID', { rpm: rpmCtx });
          break;
      }
    });
  };

  const publishTerminalOutcome = (outcome: LiveSessionTerminalOutcome) => {
    setTerminalOutcome(outcome);
    onTerminalStateChange?.(outcome);

    if (outcome.state === 'INTERRUPTED') {
      const reason = outcome.reason ?? 'UNKNOWN';
      setSessionError(`SESSION_INTERRUPTED:${reason}`);
      Vibration.vibrate([0, 120, 80, 120]);
      const spokenReason = reason === 'APP_BACKGROUND'
        ? 'because the app left the foreground'
        : reason.startsWith('DEVICE_DISCONNECTED')
          ? 'because the diagnostic adapter disconnected'
          : 'unexpectedly';
      void speakDriverMessage(`AutoPulse session stopped ${spokenReason}. Saved vehicle data is available in History.`);
    }
  };

  useEffect(() => {
    if (adapterVoltageTracker.value !== null) return;
    if (initialAdapterVoltageValue !== null) {
      adapterVoltageTracker.update(initialAdapterVoltageValue, 'VALID');
    } else if (initialAdapterVoltage !== null && initialAdapterVoltage !== undefined) {
      adapterVoltageTracker.update(null, 'UNAVAILABLE');
    }
  }, [initialAdapterVoltage, initialAdapterVoltageValue]);

  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS !== 'android') return;
      const permsToRequest = [];
      if (Platform.Version >= 33) permsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (Platform.Version >= 31) permsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

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

    requestPermissions();
    return () => {
      if (Platform.OS === 'android') ReactNativeForegroundService.stopAll();
    };
  }, []);

  useEffect(() => {
    if (terminalOutcome) return;
    const timer = setInterval(() => setSecondsElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [terminalOutcome]);

  useEffect(() => {
    if (adapterMode !== 'VIRTUAL_PREVIEW' || terminalOutcome) return;
    if (dataPoints.length === 0) setDataPoints([800]);

    const simulator = setInterval(() => {
      setDataPoints(prev => {
        const lastVal = prev.length > 0 ? prev[prev.length - 1] : 800;
        const drift = (Math.random() - 0.45) * 80;
        const nextVal = Math.max(800, Math.min(6500, lastVal + drift));
        const next = [...prev, nextVal];
        if (next.length > 20) next.shift();
        const speedCtx = { value: speedTracker.value, quality: speedTracker.advisoryState.quality, observedAt: speedTracker.lastUpdateAt };
        rpmTracker.update(nextVal, 'VALID', { speed: speedCtx });
        return next;
      });

      const numPrev = typeof speedTracker.value === 'number' ? speedTracker.value : 0;
      const lastRpm = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : 800;
      const targetSpeed = (lastRpm / 6500) * 120;
      const nextSpeed = Math.max(0, numPrev + ((targetSpeed - numPrev) * 0.1) + (Math.random() - 0.5));
      speedTracker.update(nextSpeed, 'VALID');

      const coolantPrev = typeof coolantTracker.value === 'number' ? coolantTracker.value : 90;
      coolantTracker.update(Math.min(105, coolantPrev + (Math.random() * 0.05)), 'VALID');

      // Preview-only synthetic demand signals exercise the same resolver wiring as ECU data.
      const virtualLoad = Math.max(8, Math.min(95, 18 + (lastRpm / 90) + (nextSpeed * 0.18)));
      const virtualThrottle = Math.max(3, Math.min(92, 5 + (virtualLoad * 0.62)));
      loadTracker.update(virtualLoad, 'VALID');
      throttleTracker.update(virtualThrottle, 'VALID');

      const voltagePrev = typeof adapterVoltageTracker.value === 'number' ? adapterVoltageTracker.value : 14.1;
      const voltageDrift = (Math.random() - 0.5) * 0.05;
      const virtualRpmCtx = { value: 800, quality: 'VALID' as any, observedAt: Date.now() };
      adapterVoltageTracker.update(Math.max(13.8, Math.min(14.4, voltagePrev + voltageDrift)), 'VALID', { rpm: virtualRpmCtx });
      ecuVoltageTracker.update(Math.max(13.7, Math.min(14.7, voltagePrev + voltageDrift)), 'VALID', { rpm: virtualRpmCtx });
    }, 500);
    return () => clearInterval(simulator);
  }, [adapterMode, dataPoints, terminalOutcome]);

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
        supportedPids || [],
        initialAdapterVoltageValue !== null,
      );
      liveSessionRegistry.registerController(sessionId, controller);
    }

    controller.start((result) => {
      if (commandResultContainsValidEcuSample(result)) {
        setHasValidEcuSample(true);
        setFirstEcuSampleAt(previous => previous ?? Date.now());
      }

      if (result.status !== 'SUCCESS_DECODED') return;
      applyDecodedValues(result.decodedValues);
    }, (error) => {
      setSessionError(error);
    }, publishTerminalOutcome);

    setSessionController(controller);
    return () => undefined;
  }, [adapterMode, connectionHandleId, supportedPids, localContext, productDb, sessionId, initialAdapterVoltageValue]);

  useEffect(() => {
    if (adapterMode !== 'REPLAY_WS' || !replayUrl || terminalOutcome) return;

    const controller = new ReplayObdController(replayUrl);
    const poller = new RealTelemetryPoller(
      controller,
      ['010C', '010D', '0105', '0104', '0111', '0142', 'ATRV'],
      result => {
        if (result.status !== 'SUCCESS_DECODED') return;
        applyDecodedValues(result.decodedValues);
      },
    );

    controller.connect().then(() => poller.start(300)).catch(error => console.error('[OBD Replay] Connection failed', error));
    return () => {
      poller.stop();
      controller.disconnect();
    };
  }, [adapterMode, replayUrl, terminalOutcome]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const openSummary = () => navigation.navigate('SessionSummary', {
    vehicleId,
    sessionId,
    duration: secondsElapsed,
    isVirtual: adapterMode !== 'REAL_BLE',
  });

  const handleStop = async () => {
    if (isStopping.current || terminalOutcome) return;
    isStopping.current = true;

    if (sessionController) {
      await sessionController.stopSession();
      liveSessionRegistry.unregisterController(sessionId);
    } else if (typeof activeBleController !== 'undefined') {
      activeBleController.releaseConnection();
    }

    openSummary();
  };

  const liveTruth = deriveLiveEcuTruth({
    hasValidEcuSample,
    elapsedMs: secondsElapsed * 1000,
    sessionError: terminalOutcome ? null : sessionError,
  });
  const waitingForFirstEcuSample = adapterMode === 'REAL_BLE' && !hasValidEcuSample;
  const statusLabel = terminalOutcome?.state === 'INTERRUPTED'
    ? 'SESSION INTERRUPTED'
    : terminalOutcome?.state === 'COMPLETED'
      ? 'SESSION SAVED'
      : liveTruth.label;
  const statusColor = terminalOutcome?.state === 'INTERRUPTED'
    ? '#ef4444'
    : terminalOutcome?.state === 'COMPLETED'
      ? '#10b981'
      : liveTruth.tone === 'live'
        ? '#10b981'
        : liveTruth.tone === 'waiting'
          ? '#f59e0b'
          : liveTruth.tone === 'delayed'
            ? '#f97316'
            : '#ef4444';
  const showStatusBand = Boolean(terminalOutcome)
    || adapterMode !== 'REAL_BLE'
    || liveTruth.state !== 'LIVE_ECU_DATA';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.vehicleAlias}>{vehicleLoading ? 'Vehicle' : vehicle?.alias ?? 'Vehicle'}</Text>
          <Text style={styles.subtitle}>{vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.year}` : 'Live telemetry'}</Text>
        </View>
        <View style={styles.headerActions}>
          {adapterMode === 'REAL_BLE' && firstEcuSampleAt && liveTruth.state === 'LIVE_ECU_DATA' && !terminalOutcome ? (
            <View style={styles.liveDot} />
          ) : null}
          <Text style={[styles.timerText, terminalOutcome && styles.timerTextTerminal]}>{formatTime(secondsElapsed)}</Text>
          {adapterMode === 'REAL_BLE' && AppConfig.INTERNAL_TOOLS_ENABLED && !terminalOutcome ? (
            <TouchableOpacity style={styles.diagButton} onPress={() => setShowDiagnostics(true)}>
              <Text style={styles.diagButtonText}>LOGS</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {showStatusBand ? (
        <View style={[styles.statusBand, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBandText}>{statusLabel}</Text>
        </View>
      ) : null}

      {terminalOutcome?.state === 'INTERRUPTED' ? (
        <View style={styles.terminalNotice}>
          <View style={styles.terminalCopy}>
            <Text style={styles.terminalTitle}>Recording stopped</Text>
            <Text style={styles.terminalText}>{terminalOutcome.reason ?? 'Unexpected interruption'} · saved evidence remains available.</Text>
          </View>
          <View style={styles.terminalDot} />
        </View>
      ) : liveTruth.state !== 'LIVE_ECU_DATA' && adapterMode === 'REAL_BLE' ? (
        <View style={styles.statusDetailContainer}>
          <Text style={styles.statusDetailText}>{liveTruth.detail}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.grid}>
          <LiveMetricCard label="Engine RPM" value={rpmTracker.value} unit="rpm" state={rpmTracker.advisoryState} stats={rpmTracker.stats} profile={DEMO_PROFILES.ENGINE_RPM} observedAt={rpmTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-engine-rpm" />
          <LiveMetricCard label="Vehicle Speed" value={speedTracker.value} unit="km/h" state={speedTracker.advisoryState} stats={speedTracker.stats} profile={DEMO_PROFILES.VEHICLE_SPEED} observedAt={speedTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-vehicle-speed" />
          <LiveMetricCard label="Engine Coolant" value={coolantTracker.value} unit="°C" state={coolantTracker.advisoryState} stats={coolantTracker.stats} profile={DEMO_PROFILES.ENGINE_COOLANT} observedAt={coolantTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-engine-coolant" />
          <LiveMetricCard label="Engine Load" value={loadTracker.value} unit="%" state={loadTracker.advisoryState} stats={loadTracker.stats} profile={DEMO_PROFILES.ENGINE_LOAD} observedAt={loadTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-engine-load" />
          <LiveMetricCard label="Throttle Position" value={throttleTracker.value} unit="%" state={throttleTracker.advisoryState} stats={throttleTracker.stats} profile={DEMO_PROFILES.THROTTLE_POSITION} observedAt={throttleTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-throttle-position" />
          <LiveMetricCard label="ECU Voltage" value={ecuVoltageTracker.value} unit="V" state={ecuVoltageTracker.advisoryState} stats={ecuVoltageTracker.stats} profile={DEMO_PROFILES.CONTROL_VOLTAGE} observedAt={ecuVoltageTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'ECU direct' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-ecu-voltage" />
          <LiveMetricCard label="Adapter Voltage" value={adapterVoltageTracker.value} unit="V" state={adapterVoltageTracker.advisoryState} stats={adapterVoltageTracker.stats} profile={DEMO_PROFILES.CONTROL_VOLTAGE} observedAt={adapterVoltageTracker.lastUpdateAt} origin={adapterMode === 'REAL_BLE' ? 'Adapter measurement' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual'} testID="live-metric-card-adapter-voltage" />
        </View>

        {supplement}

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>RPM TREND</Text>
          {dataPoints.length > 0 ? (
            <LineChart
              data={{ labels: [], datasets: [{ data: dataPoints }] }}
              width={screenWidth - 32}
              height={118}
              chartConfig={{
                backgroundColor: '#11191d',
                backgroundGradientFrom: '#11191d',
                backgroundGradientTo: '#11191d',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                style: { borderRadius: 14 },
                propsForDots: { r: '2', strokeWidth: '1', stroke: '#4ade80' },
              }}
              bezier
              withInnerLines={false}
              withOuterLines={false}
              style={styles.chart}
            />
          ) : (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                {waitingForFirstEcuSample
                  ? liveTruth.state === 'ECU_DATA_DELAYED'
                    ? 'ECU data delayed · still retrying'
                    : 'Waiting for first ECU sample…'
                  : 'Waiting for RPM data…'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {terminalOutcome ? (
          <View style={styles.terminalActions}>
            <TouchableOpacity style={styles.summaryButton} onPress={openSummary}>
              <Text style={styles.summaryButtonText}>View Summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.historyButton} onPress={() => navigation.navigate('History')}>
              <Text style={styles.historyButtonText}>History</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <View style={styles.stopIcon} />
            <Text style={styles.stopButtonText}>Stop Session</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={AppConfig.INTERNAL_TOOLS_ENABLED && showDiagnostics} animationType="slide" presentationStyle="pageSheet">
        <DiagnosticsLogScreen onClose={() => setShowDiagnostics(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#151d21',
  },
  headerCopy: { flex: 1, paddingRight: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleAlias: { color: '#fff', fontSize: 19, fontFamily: 'Inter_700Bold' },
  subtitle: { color: '#94a3b8', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  timerText: { color: '#f8fafc', fontFamily: 'SpaceMono_700Bold', fontSize: 16 },
  timerTextTerminal: { color: '#94a3b8' },
  diagButton: { backgroundColor: '#263239', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7 },
  diagButtonText: { color: '#94a3b8', fontSize: 8, fontFamily: 'Inter_700Bold' },
  statusBand: { minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  statusBandText: { color: '#071014', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.1, textAlign: 'center' },
  statusDetailContainer: { backgroundColor: '#11191d', paddingHorizontal: 16, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#263239' },
  statusDetailText: { color: '#94a3b8', fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  liveHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, backgroundColor: '#0f171a' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveHintText: { color: '#64748b', fontSize: 9, fontFamily: 'Inter_500Medium' },
  terminalNotice: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#171517', borderBottomWidth: 1, borderBottomColor: '#3f2528' },
  terminalCopy: { flex: 1 },
  terminalTitle: { color: '#f8fafc', fontSize: 12, fontFamily: 'Inter_700Bold' },
  terminalText: { color: '#cbd5e1', fontSize: 10, lineHeight: 14, marginTop: 2 },
  terminalDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444', marginLeft: 12 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  contentContainer: { paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  chartContainer: { backgroundColor: '#11191d', paddingHorizontal: 0, paddingTop: 10, paddingBottom: 4, borderRadius: 14, borderWidth: 1, borderColor: '#263239', overflow: 'hidden', marginTop: 8 },
  chartTitle: { color: '#64748b', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginLeft: 12, marginBottom: 2 },
  chart: { marginVertical: 0, borderRadius: 14 },
  chartPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  chartPlaceholderText: { color: '#64748b', fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#151d21', borderTopWidth: 1, borderTopColor: '#263239' },
  stopButton: { minHeight: 50, backgroundColor: '#ef4444', borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  stopIcon: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#fff' },
  stopButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  terminalActions: { flexDirection: 'row', gap: 9 },
  summaryButton: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  summaryButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  historyButton: { minWidth: 104, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  historyButtonText: { color: '#e2e8f0', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
