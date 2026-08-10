import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, PermissionsAndroid, Permission, Platform, SafeAreaView } from 'react-native';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import { useKeepAwake } from 'expo-keep-awake';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { LiveMetricCard } from './components/LiveMetricCard';
import { LiveHistoryChart, DataPoint } from './components/LiveHistoryChart';
import { MetricDetailSheet } from './components/MetricDetailSheet';
import { DEMO_PROFILES } from '../../domain/telemetry/SignalProfiles';
import { liveSessionRegistry } from '../../application/live/LiveSessionRegistry';
import { useLiveSignalTracking } from '../../infrastructure/hooks/useLiveSignalTracking';
import { DynamicLiveMetricCard, DynamicLiveMetricCardRef, formatSignalLabel } from './components/DynamicLiveMetricCard';
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
import { obdTransportRegistry } from '../../application/live/ObdTransportRegistry';

export default function LiveSessionScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vehicleId, sessionId, adapterMode, connectionHandleId, resolvedPollingSet, initialAdapterVoltage, replayUrl } = route.params || {};

  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    // Capture unhandled promise rejections that bubble up in this screen's lifecycle
    const rejectionTracker = (event: any) => {
      console.error('CAPTURED UNHANDLED REJECTION:', event);
      if (event && event.reason) {
         setSessionError(`Unhandled Rejection:\nMessage: ${event.reason.message || event.reason}\nStack: ${event.reason.stack || 'No stack'}`);
      }
    };
    
    if (typeof global !== 'undefined' && (global as any).onunhandledrejection !== undefined) {
      const original = (global as any).onunhandledrejection;
      (global as any).onunhandledrejection = (err: any) => {
        rejectionTracker({ reason: err });
        if (original) original(err);
      };
      return () => { (global as any).onunhandledrejection = original; };
    }
  }, []);

  const { vehicle } = useVehicle(vehicleId);

  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const [histories, setHistories] = useState<Record<string, DataPoint[]>>({});
  const [selectedMetricId, setSelectedMetricId] = useState<string>('ENGINE_RPM');
  const [detailVisible, setDetailVisible] = useState(false);

  const { signals } = useLiveSignalTracking(sessionId);
  const cardsRef = useRef<Record<string, DynamicLiveMetricCardRef>>({});

  const [sessionCoordinator, setSessionCoordinator] = useState<LiveSessionCoordinator | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const productDb = useProductDb();
  const { context: localContext } = useLocalContext();

  const isStopping = useRef(false);
  const coordinatorStarted = useRef(false);

  useEffect(() => {
    if (initialAdapterVoltage && cardsRef.current['ADAPTER_VOLTAGE']) {
      const match = String(initialAdapterVoltage).match(/(\d+(?:\.\d+)?)/);
      cardsRef.current['ADAPTER_VOLTAGE'].update(match ? Number(match[1]) : null, match ? 'VALID' : 'UNAVAILABLE');
    }
  }, [initialAdapterVoltage]);

  useEffect(() => {
    if (!productDb || !localContext || !sessionId) return;
    const sessionRepo = new LiveSessionRepository(productDb);
    sessionRepo.getSessionById(localContext.defaultWorkspaceId, sessionId).then(session => {
       console.log(`[LIVE SESSION] sessionId=${sessionId} monitoringProfile=${session?.monitoringProfile} adapterMode=${adapterMode}`);
    }).catch(console.error);
  }, [productDb, localContext, sessionId, adapterMode]);

  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS === 'android') {
        const permsToRequest: Permission[] = [];
        if (Platform.Version >= 33) permsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (Platform.Version >= 31) permsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

        if (permsToRequest.length > 0) {
          try { await PermissionsAndroid.requestMultiple(permsToRequest); } catch (err) {}
        }
        try {
          ReactNativeForegroundService.start({
            id: 1234,
            title: "AutoPulse",
            message: "Conexión activa",
            icon: "ic_launcher",
            button: false,
            button2: false,
            setOnlyAlertOnce: "true",
            color: "#000000",
          });
        } catch (err) {}
      }
    }
    requestPermissions().catch(err => {
      console.error('Unhandled Rejection in requestPermissions:', err);
    });

    return () => {
      if (Platform.OS === 'android') ReactNativeForegroundService.stopAll();
    };
  }, []);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const addPointToHistory = (signalId: string, value: number) => {
    const now = Date.now();
    setHistories(prev => {
      const arr = prev[signalId] || [];
      const windowStart = now - 35000;
      return { ...prev, [signalId]: [...arr.filter(p => p.timestamp >= windowStart), { timestamp: now, value }] };
    });
  };

  // Create stable configuration keys
  const stableSignalKey = [...new Set(signals.map(s => s.signalDefinitionId))].sort().join('|');

  const signalsRef = useRef(signals);
  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  const historiesRef = useRef(histories);
  useEffect(() => {
    historiesRef.current = histories;
  }, [histories]);

  // Virtual Simulator
  useEffect(() => {
    if (adapterMode !== 'VIRTUAL_PREVIEW') return;
    if (!stableSignalKey) return; // Wait for signals

    console.log(`[VIRTUAL INIT] Starting simulator for signals: ${stableSignalKey}`);

    const simulator = setInterval(() => {
      signalsRef.current.forEach(s => {
        const id = s.signalDefinitionId;
        const lastArr = historiesRef.current[id] || [];
        const lastVal = lastArr.length > 0 ? lastArr[lastArr.length - 1].value : 0;
        let nextVal = lastVal;
        
        if (id === 'ENGINE_RPM') nextVal = Math.max(800, Math.min(6500, (lastVal || 800) + (Math.random() - 0.45) * 80));
        else if (id === 'VEHICLE_SPEED') nextVal = Math.max(0, (lastVal || 0) + (Math.random() - 0.5));
        else if (id === 'ENGINE_COOLANT') nextVal = Math.min(105, (lastVal || 90) + (Math.random() * 0.05));
        else if (id === 'CONTROL_MODULE_VOLTAGE' || id === 'ADAPTER_VOLTAGE') nextVal = Math.max(13.8, Math.min(14.4, (lastVal || 14.1) + (Math.random() - 0.5) * 0.05));
        else nextVal = (lastVal || 10) + Math.random() * 2 - 1; 

        // Less noisy dispatch log
        // console.log(`[LIVE DISPATCH] ${id} → value = ${nextVal}`);
        addPointToHistory(id, nextVal);
        if (cardsRef.current[id]) {
           cardsRef.current[id].update(nextVal, 'VALID');
        }
      });
    }, 500);

    return () => {
      console.log(`[VIRTUAL CLEANUP] Stopping simulator for signals: ${stableSignalKey}`);
      clearInterval(simulator);
    };
  }, [sessionId, adapterMode, stableSignalKey]);

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
        resolvedPollingSet || []
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
          
          const executor = obdTransportRegistry.take(connectionHandleId);
          if (!executor) {
             const sessionRepo = new LiveSessionRepository(productDb);
             await sessionRepo.failSession(localContext.defaultWorkspaceId, sessionId, 'HANDOFF_FAILED');
             activeBleController.releaseConnection();
             throw new Error('CONNECTION_LOST: Transport handoff failed.');
          }

          lease = {
            executor,
            sourceType: 'REAL_BLE',
            release: async () => {
              executor.disconnect();
              activeBleController.releaseConnection();
            }
          };
        } else {
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
            if (result.status === 'NO_DATA' || result.status === 'TIMEOUT' || result.status === 'INVALID_RESPONSE' || result.status === 'ELM_ERROR') return;
            const reading = result.status === 'SUCCESS_DECODED' ? result.decodedValues[0] : null;
            if (reading && reading.value !== null) {
              const speedCtx = cardsRef.current['VEHICLE_SPEED']?.getContextSnapshot();
              const rpmCtx = cardsRef.current['ENGINE_RPM']?.getContextSnapshot();
              
              const type = reading.type;
              addPointToHistory(type, reading.value as number);
              
              let contextObj: any = undefined;
              if (type === 'ENGINE_RPM') contextObj = { speed: speedCtx };
              else if (type === 'CONTROL_MODULE_VOLTAGE') contextObj = { rpm: rpmCtx };

              if (cardsRef.current[type]) {
                cardsRef.current[type].update(reading.value as number, 'VALID', contextObj);
              }
            }
          },
          (err) => { setSessionError(err); }
        );
      } catch (err: any) {
        setSessionError(err.message || 'Failed to start session');
      }
    };
    setupLeaseAndStart().catch(err => {
      console.error('Unhandled Rejection in setupLeaseAndStart:', err);
      setSessionError('Failed to start session: ' + (err.message || 'Unknown error'));
    });
  }, [adapterMode, connectionHandleId, resolvedPollingSet, replayUrl, localContext, productDb]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStop = async () => {
    try {
      if (isStopping.current) return;
      isStopping.current = true;

      if (sessionCoordinator) {
        await sessionCoordinator.stopSession();
        liveSessionRegistry.unregisterController(sessionId);
      } else {
        // Virtual mode: no coordinator, but we must finalize the session in DB
        if (productDb && localContext) {
          const sessionRepo = new LiveSessionRepository(productDb);
          await sessionRepo.completeSession(localContext.defaultWorkspaceId, sessionId);
        }
        
        if (typeof activeBleController !== 'undefined') {
          activeBleController.releaseConnection();
        }
      }

      navigation.replace('SessionSummary', {
        vehicleId,
        sessionId,
        duration: secondsElapsed,
        isVirtual: adapterMode !== 'REAL_BLE' && adapterMode !== 'REPLAY_WS'
      });
    } catch (err: any) {
      console.error('Unhandled Rejection in handleStop:', err);
      setSessionError('Stop failed: ' + (err.message || 'Unknown error'));
      isStopping.current = false;
    }
  };

  const activeHistory = histories[selectedMetricId] || [];

  const activeSignal = signals.find(s => s.signalDefinitionId === selectedMetricId);
  const activeLabel = activeSignal?.signalDefinitionId ? formatSignalLabel(activeSignal.signalDefinitionId) : 'UNKNOWN';
  const activeUnit = activeSignal?.effectiveUnit || '';
  
  const activeRef = cardsRef.current[selectedMetricId];
  const activeState = activeRef ? activeRef.getContextSnapshot() : { quality: 'UNAVAILABLE' };
  const activeValue = activeRef ? activeRef.getContextSnapshot().value : null;
  const activeColor = activeRef?.getContextSnapshot().quality === 'INVALID' ? '#ef4444' : '#4ade80';

  // Voltage naming logic
  const isEcuVoltage = resolvedPollingSet?.includes('0142');
  const voltageOriginLabel = isEcuVoltage ? 'ECU' : 'Adapter';
  const voltageCardLabel = isEcuVoltage ? 'ECU VOLT' : 'VOLTAGE';

  const originText = adapterMode === 'REAL_BLE' ? 'ECU' : adapterMode === 'REPLAY_WS' ? 'Laptop Replay' : 'Virtual';

  // Instance tracking
  const instanceId = useRef(Math.floor(Math.random() * 10000)).current;

  useEffect(() => {
    console.log(`[LIVE INSTANCE] instance=${instanceId} sessionId=${sessionId} MOUNTED`);
    return () => console.log(`[LIVE INSTANCE] instance=${instanceId} UNMOUNTED`);
  }, [instanceId, sessionId]);

  // Log exactly what we are about to render
  console.log(`[LIVE CARD MODEL] instance=${instanceId} sessionId=${sessionId} signals=${signals.map(s => s.signalDefinitionId).join(', ')}`);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerCompact}>
        <View style={styles.headerLeft}>
          <View style={[styles.liveDot, { backgroundColor: sessionError ? '#ef4444' : '#4ade80' }]} />
          <Text style={styles.headerTitle}>LIVE</Text>
          <Text style={styles.headerSeparator}>·</Text>
          <Text style={styles.headerAlias}>{vehicle?.alias || 'Unknown'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.timerText}>{formatTime(secondsElapsed)}</Text>
          <TouchableOpacity style={styles.stopIconBtn} onPress={handleStop}>
            <View style={styles.stopSquare} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {sessionError && (
          <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
             <Text style={{ color: '#b91c1c', fontFamily: 'SpaceMono_400Regular', fontSize: 11 }}>{sessionError}</Text>
          </View>
        )}
        <View style={styles.grid}>
          {signals.map(s => (
            <DynamicLiveMetricCard
              key={s.signalDefinitionId}
              signal={s}
              isSelected={selectedMetricId === s.signalDefinitionId}
              onSelect={setSelectedMetricId}
              ref={(el) => {
                if (el) cardsRef.current[s.signalDefinitionId] = el;
              }}
            />
          ))}
        </View>

        <LiveHistoryChart
          dataPoints={activeHistory}
          metricLabel={activeLabel}
          unit={activeUnit}
          onPress={() => setDetailVisible(true)}
          accentColor={activeColor}
        />
      </View>

      {detailVisible && (
        <MetricDetailSheet
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          label={activeLabel}
          value={activeValue}
          unit={activeUnit}
          state={activeState}
          stats={activeRef ? activeRef.getStats() : {}}
          profile={DEMO_PROFILES[selectedMetricId as keyof typeof DEMO_PROFILES] as any}
          origin={originText}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1417' },
  headerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1a2227',
    borderBottomWidth: 1,
    borderBottomColor: '#2a3439'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  headerTitle: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  headerSeparator: { color: '#6b7280', fontSize: 14, marginHorizontal: 8 },
  headerAlias: { color: '#d1d5db', fontSize: 14, fontFamily: 'Inter_500Medium' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: { color: '#9ca3af', fontFamily: 'SpaceMono_400Regular', fontSize: 13, marginRight: 16 },
  stopIconBtn: {
    padding: 8,
  },
  stopSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#ef4444',
    borderRadius: 2
  },
  content: { 
    flex: 1, 
    padding: 16,
    flexDirection: 'column'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  }
});
