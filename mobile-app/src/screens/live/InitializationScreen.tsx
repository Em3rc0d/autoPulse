import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { RealObdInitialization } from '../../infrastructure/ble/real/RealObdInitialization';
import { Ionicons } from '@expo/vector-icons';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { CapabilitySnapshotRepository, ECUInput, ParameterInput } from '../../infrastructure/database/product/repositories/capability-snapshot.repository';

import { useKeepAwake } from 'expo-keep-awake';

export default function InitializationScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { vehicleId, sessionId, adapterMode, connectionHandleId, adapterInstanceId } = route.params || {};
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId || null);

  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId);

  const [virtualSteps, setVirtualSteps] = useState([
    { id: '1', label: 'Virtual adapter ready', status: 'pending' },
    { id: '2', label: 'Virtual transport initialized', status: 'pending' },
    { id: '3', label: 'Virtual protocol selected', status: 'pending' },
    { id: '4', label: 'Virtual capabilities loaded', status: 'pending' },
    { id: '5', label: 'Signals ready', status: 'pending' },
  ]);

  const [realSteps, setRealSteps] = useState([
    { id: '1', label: 'BLE adapter connected', status: 'pending' },
    { id: '2', label: 'ELM327 identified', status: 'pending' },
    { id: '3', label: 'Configuring adapter', status: 'pending' },
    { id: '4', label: 'Detecting vehicle protocol', status: 'pending' },
    { id: '5', label: 'Checking supported signals', status: 'pending' },
    { id: '6', label: 'Preparing live session', status: 'pending' },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const initializationStarted = React.useRef(false);
  const preparationBegun = React.useRef(false);

  const productDb = useProductDb();
  const { context: localContext, loading: contextLoading } = useLocalContext();

  const executeRealInitialization = useCallback(async () => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    setInitError(null);
    console.log('[InitializationScreen] executeRealInitialization started.');

    if (contextLoading) {
       console.log('[InitializationScreen] Wait, context is still loading.');
       initializationStarted.current = false;
       return; // Wait until loaded
    }

    if (!localContext || !productDb) {
      console.log('[InitializationScreen] Error: LOCAL_CONTEXT_UNAVAILABLE');
      setInitError('LOCAL_CONTEXT_UNAVAILABLE: Cannot initialize real session without context.');
      initializationStarted.current = false;
      return;
    }

    if (!adapterInstanceId) {
      setInitError('ADAPTER_INSTANCE_UNAVAILABLE: Cannot initialize a real session without a persisted adapter instance.');
      initializationStarted.current = false;
      return;
    }

    const sessionRepo = new LiveSessionRepository(productDb);
    const capRepo = new CapabilitySnapshotRepository(productDb);
    let sessionIdForRun = activeSessionId || sessionId;

    try {
      if (!preparationBegun.current) {
        try {
          await sessionRepo.beginPreparation(localContext.defaultWorkspaceId, sessionIdForRun);
        } catch (err: any) {
          const message = err?.message || '';
          if (message.includes('FAILED -> PREPARING')) {
            sessionIdForRun = await sessionRepo.createSession(
              localContext.defaultWorkspaceId,
              vehicleId,
              localContext.defaultOperatorId,
              adapterInstanceId
            );
            setActiveSessionId(sessionIdForRun);
            await sessionRepo.beginPreparation(localContext.defaultWorkspaceId, sessionIdForRun);
          } else {
            throw err;
          }
        }
        preparationBegun.current = true;
      }
    } catch (err) {
      console.error('Failed to begin preparation:', err);
      setInitError(`SESSION_PREPARATION_FAILED: ${err instanceof Error ? err.message : 'Could not prepare session.'}`);
      initializationStarted.current = false;
      return;
    }

    const conn = activeBleController.getConnection(connectionHandleId);
    if (!connectionHandleId || !conn) {
      setInitError('CONNECTION_LOST: Adapter connection handle is missing or no longer active.');
      initializationStarted.current = false;
      return;
    }

    let controller: RealObdController | null = null;
    try {
      controller = new RealObdController(conn);
      const initialization = new RealObdInitialization(controller, (stepIndex) => {
        setRealSteps(prev => {
          const newSteps = [...prev];
          for (let i = 0; i < stepIndex; i++) {
            newSteps[i].status = 'done';
          }
          if (stepIndex < newSteps.length) {
            newSteps[stepIndex].status = 'pending'; // Active step
          }
          setCurrentStepIndex(stepIndex);
          return newSteps;
        });
      });

      const snapshot = await initialization.execute();

      if (!snapshot.initializationSuccessful) {
        setInitError(`Could not communicate with the vehicle ECU\n\nAdapter connection: OK\nELM327 response: ${snapshot.failureReason || 'UNKNOWN'}`);
        if (controller) controller.disconnect();
        initializationStarted.current = false;
        return;
      }

      setRealSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
      setCurrentStepIndex(realSteps.length);
      let liveSupportedPids = [...snapshot.supportedPids];

      // Persist capabilities
      try {
        const ecus: ECUInput[] = [{ address: 0, protocol: snapshot.protocol || 'UNKNOWN' }];
        const parameters: ParameterInput[] = snapshot.supportedPids.map(pid => ({
          ecuAddress: 0,
          parameterDefinitionId: pid,
          supportState: snapshot.directlyObservedPids?.includes(pid) ? 'DIRECTLY_OBSERVED' : 'SUPPORTED'
        }));

        // Add 0142 as NOT_AVAILABLE if not in supportedPids
        if (!snapshot.supportedPids.includes('0142')) {
          parameters.push({
            ecuAddress: 0,
            parameterDefinitionId: '0142',
            supportState: 'NOT_AVAILABLE'
          });
        }

        const capSnapshot = await capRepo.createSnapshot(
          localContext.defaultWorkspaceId,
          vehicleId,
          adapterInstanceId,
          '1.0', // profile version
          snapshot.protocol || 'UNKNOWN',
          'BLE',
          ecus,
          parameters
        );

        const coreSignalDefinitions: Record<string, {
          numericType: string;
          unit: string;
          decoderKey: string;
          precision: number;
          priority: string;
        }> = {
          '010C': { numericType: 'float', unit: 'RPM', decoderKey: 'MODE01_010C', precision: 0, priority: 'HIGH' },
          '010D': { numericType: 'integer', unit: 'km/h', decoderKey: 'MODE01_010D', precision: 0, priority: 'HIGH' },
          '0105': { numericType: 'float', unit: '°C', decoderKey: 'MODE01_0105', precision: 1, priority: 'MEDIUM' },
          '0142': { numericType: 'float', unit: 'V', decoderKey: 'MODE01_0142', precision: 2, priority: 'LOW' }
        };
        const discoveredSupportedPids = [...snapshot.supportedPids];
        const requiredLivePids = ['010C', '010D', '0105', '0142'];
        const probeCandidatePids = requiredLivePids.filter(pid => !discoveredSupportedPids.includes(pid));
        
        const activePollingPids = [...discoveredSupportedPids];
        if (probeCandidatePids.length > 0) {
          console.log(`[InitializationScreen] Injecting live polling fallbacks: ${probeCandidatePids.join(', ')}`);
          activePollingPids.push(...probeCandidatePids);
        }
        liveSupportedPids = activePollingPids;

        const signals = activePollingPids
          .filter(pid => coreSignalDefinitions[pid])
          .map((pid, index) => {
            const isProbed = probeCandidatePids.includes(pid);
            return {
              signalDefinitionId: pid,
              parameterDefinitionId: pid,
              service: 1,
              pid: parseInt(pid.replace('01', ''), 16) || 0,
              targetEcu: 0,
              effectiveUnit: coreSignalDefinitions[pid].unit,
              numericType: coreSignalDefinitions[pid].numericType,
              scale: 1,
              offset: 0,
              precision: coreSignalDefinitions[pid].precision,
              decoderVersion: '1.0',
              decoderKey: coreSignalDefinitions[pid].decoderKey,
              origin: snapshot.directlyObservedPids?.includes(pid) ? 'DIRECTLY_OBSERVED' : 'BITMAP',
              priority: coreSignalDefinitions[pid].priority,
              targetPeriodMs: 250,
              indexInBlock: index,
              supportState: isProbed ? ('NOT_AVAILABLE' as any) : ('SUPPORTED' as any),
              localTargetIndex: index,
              localSignalIndex: index
            };
          });

        if (signals.length === 0) {
          throw new Error('NO_SUPPORTED_CORE_SIGNALS: ECU responded, but no supported RPM/Speed/Coolant/Voltage signals were available.');
        }

        await sessionRepo.attachCapabilitySnapshot(
          localContext.defaultWorkspaceId,
          sessionIdForRun,
          capSnapshot.id,
          '1.0',
          snapshot.protocol || 'UNKNOWN',
          'BLE'
        );

        await sessionRepo.attachSignalSnapshots(localContext.defaultWorkspaceId, sessionIdForRun, signals);
        await sessionRepo.activateSession(localContext.defaultWorkspaceId, sessionIdForRun);
      } catch (err) {
        console.error('Failed to persist capabilities/activation:', err);
        try {
          await sessionRepo.failSession(localContext.defaultWorkspaceId, sessionIdForRun, 'ACTIVATION_PERSISTENCE_FAILED');
        } catch (failErr) {
          console.error('Failed to mark initialization as failed:', failErr);
        }
        setInitError(`SESSION_ACTIVATION_FAILED: ${err instanceof Error ? err.message : 'Could not persist session activation.'}`);
        if (controller) controller.disconnect();
        initializationStarted.current = false;
        return;
      }

      setTimeout(() => {
        navigation.navigate('LiveSession', {
          vehicleId,
          sessionId: sessionIdForRun,
          adapterMode: 'REAL_BLE',
          connectionHandleId,
          supportedPids: liveSupportedPids,
          initialAdapterVoltage: snapshot.adapterIdentity?.supplyVoltage
        });
      }, 500);

    } catch (error) {
      setInitError('OBD_INIT_FAILED: Unexpected error during initialization.');
      if (controller) controller.disconnect();
      initializationStarted.current = false;
    }
  }, [activeSessionId, adapterInstanceId, connectionHandleId, navigation, sessionId, vehicleId, realSteps.length, contextLoading, localContext, productDb]);

  useEffect(() => {
    if (!adapterMode) {
      setInitError('INVALID_SESSION_ORIGIN: Missing adapter mode.');
      return;
    }

    if (adapterMode === 'VIRTUAL_PREVIEW') {
      if (currentStepIndex < virtualSteps.length) {
        const timer = setTimeout(() => {
          setVirtualSteps(prev => {
            const newSteps = [...prev];
            newSteps[currentStepIndex].status = 'done';
            return newSteps;
          });
          setCurrentStepIndex(currentStepIndex + 1);
        }, 800);
        return () => clearTimeout(timer);
      } else {
        const finishTimer = setTimeout(() => {
          navigation.navigate('LiveSession', { vehicleId, sessionId, adapterMode: 'VIRTUAL_PREVIEW' });
        }, 500);
        return () => clearTimeout(finishTimer);
      }
    } else if (adapterMode === 'REAL_BLE') {
      if (!contextLoading && !initializationStarted.current && !initError) {
        console.log('[InitializationScreen] Triggering executeRealInitialization (context is ready)');
        executeRealInitialization();
      }
    } else {
       setInitError(`INVALID_SESSION_ORIGIN: Unknown adapter mode ${adapterMode}`);
    }
  }, [currentStepIndex, virtualSteps.length, adapterMode, executeRealInitialization, initError, navigation, sessionId, vehicleId, contextLoading]);

  const handleRetry = () => {
    setRealSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
    setCurrentStepIndex(0);
    initializationStarted.current = false;
    setInitError(null);
  };

  const activeSteps = adapterMode === 'REAL_BLE' ? realSteps : virtualSteps;

  if (initError) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning" size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>{initError}</Text>

        {adapterMode === 'REAL_BLE' && (
          <TouchableOpacity style={[styles.primaryButton, { marginBottom: 16 }]} onPress={handleRetry}>
            <Text style={styles.primaryButtonText}>Retry ECU Connection</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Initializing Session</Text>
        {vehicleLoading ? (
          <Text style={styles.subtitle}>Loading vehicle...</Text>
        ) : vehicle ? (
          <View>
            <Text style={styles.vehicleAlias}>{vehicle.alias}</Text>
            <Text style={styles.subtitle}>{vehicle.make} {vehicle.model} · {vehicle.year}</Text>
            <Text style={styles.technicalText}>{vehicleId.substring(0, 8)}...</Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>Vehicle unavailable</Text>
        )}
      </View>

      {adapterMode === 'VIRTUAL_PREVIEW' && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>VIRTUAL SESSION — DEVELOPMENT ONLY</Text>
        </View>
      )}

      <View style={styles.content}>
        {activeSteps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isDone = step.status === 'done';
          const isPending = step.status === 'pending' && !isActive;

          // For the protocol detection step (index 3), show waiting sub-text if active
          const isDetectingProtocol = isActive && step.id === '4';

          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.iconContainer}>
                {isDone && <Text style={styles.iconDone}>✓</Text>}
                {isActive && <ActivityIndicator size="small" color="#4ade80" />}
                {isPending && <View style={styles.dot} />}
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={[
                  styles.stepLabel,
                  isDone && styles.stepLabelDone,
                  isActive && styles.stepLabelActive,
                  isPending && styles.stepLabelPending
                ]}>
                  {step.label}
                </Text>
                {isDetectingProtocol && (
                  <Text style={styles.subtextLabel}>Waiting for ECU response...</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1417',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0e1417',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    fontFamily: 'SpaceMono_400Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
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
  warningBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)', // yellow with opacity
    borderBottomWidth: 1,
    borderBottomColor: '#eab308',
    padding: 12,
    alignItems: 'center',
  },
  warningText: {
    color: '#facc15',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconDone: {
    color: '#4ade80',
    fontSize: 20,
    fontWeight: 'bold',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  stepLabel: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  stepLabelDone: {
    color: '#9ca3af',
  },
  stepLabelActive: {
    color: '#fff',
  },
  stepLabelPending: {
    color: '#4b5563',
  },
  stepTextContainer: {
    flex: 1,
  },
  subtextLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  secondaryButtonText: {
    color: '#d1d5db',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  }
});
