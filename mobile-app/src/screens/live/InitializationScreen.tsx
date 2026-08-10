import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useVehicle } from '../../infrastructure/hooks/useVehicle';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { ObdCommandProcessor } from '../../infrastructure/ble/real/ObdCommandProcessor';
import { BleRawTransport } from '../../infrastructure/ble/real/BleRawTransport';
import { ReplayRawTransport } from '../../infrastructure/obd-replay/ReplayRawTransport';
import { RealObdInitialization } from '../../infrastructure/ble/real/RealObdInitialization';
import { obdTransportRegistry } from '../../application/live/ObdTransportRegistry';
import { Ionicons } from '@expo/vector-icons';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { OBD_SIGNAL_REGISTRY } from '../../domain/telemetry/ObdSignalRegistry';
import { resolveDrivingModeSignals, MonitoringProfile } from '../../domain/telemetry/DrivingModes';
import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { CapabilitySnapshotRepository, ECUInput, ParameterInput } from '../../infrastructure/database/product/repositories/capability-snapshot.repository';
import { liveSessionEvents } from '../../infrastructure/database/product/schema/live';
import { signalDefinitions } from '../../infrastructure/database/product/schema/signals';
import { inArray } from 'drizzle-orm';
import { ProductIdGenerator } from '../../infrastructure/database/product/uuidv7';

import { useKeepAwake } from 'expo-keep-awake';

export default function InitializationScreen() {
  useKeepAwake();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { vehicleId, sessionId, adapterMode, connectionHandleId, adapterInstanceId, replayUrl, monitoringProfile: routeProfile } = route.params || {};
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId || null);

  console.log(`[INITIALIZATION ENTRY] route.monitoringProfile=${routeProfile} adapterMode=${adapterMode} sessionId=${sessionId}`);

  const { vehicle, loading: vehicleLoading } = useVehicle(vehicleId);

  const [virtualSteps, setVirtualSteps] = useState([
    { id: '1', label: 'Virtual adapter ready', status: 'pending' },
    { id: '2', label: 'Virtual transport initialized', status: 'pending' },
    { id: '3', label: 'Virtual protocol selected', status: 'pending' },
    { id: '4', label: 'Virtual capabilities loaded', status: 'pending' },
    { id: '5', label: 'Signals ready', status: 'pending' },
  ]);

  const [realSteps, setRealSteps] = useState([
    { id: '1', label: 'Adapter connected', status: 'pending' },
    { id: '2', label: 'ELM327 identified', status: 'pending' },
    { id: '3', label: 'Configuring adapter', status: 'pending' },
    { id: '4', label: 'Detecting vehicle protocol', status: 'pending' },
    { id: '5', label: 'Checking supported signals', status: 'pending' },
    { id: '6', label: 'Preparing live session', status: 'pending' },
  ]);

  const currentStepIndexState = useState(0);
  const currentStepIndex = currentStepIndexState[0];
  const setCurrentStepIndex = currentStepIndexState[1];
  const initErrorState = useState<string | null>(null);
  const initError = initErrorState[0];
  const setInitError = initErrorState[1];
  const attemptStatus = React.useRef<'IDLE' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'>('IDLE');
  const attemptKey = React.useRef<string>('');
  const transportRef = React.useRef<BleRawTransport | null>(null);

  const productDb = useProductDb();
  const { context: localContext, loading: contextLoading } = useLocalContext();

  const executeInitialization = useCallback(async () => {
    const currentAttemptKey = `${vehicleId}|${adapterMode}|${sessionId || activeSessionId}|${routeProfile || 'GENERAL'}`;
    
    if (attemptStatus.current === 'RUNNING' || attemptStatus.current === 'COMPLETED') {
      if (attemptKey.current === currentAttemptKey) {
        return;
      }
    }

    attemptStatus.current = 'RUNNING';
    attemptKey.current = currentAttemptKey;
    setInitError(null);

    if (contextLoading) {
       attemptStatus.current = 'IDLE';
       return; 
    }

    if (!localContext || !productDb) {
      setInitError('LOCAL_CONTEXT_UNAVAILABLE: Cannot initialize session without context.');
      attemptStatus.current = 'FAILED';
      return;
    }

    if (!adapterInstanceId) {
      setInitError('ADAPTER_INSTANCE_UNAVAILABLE: Cannot initialize session without a persisted adapter instance.');
      attemptStatus.current = 'FAILED';
      return;
    }

    const sessionRepo = new LiveSessionRepository(productDb);
    const capRepo = new CapabilitySnapshotRepository(productDb);
    let sessionIdForRun = activeSessionId || sessionId;

    try {
      if (sessionIdForRun) {
        const session = await sessionRepo.getSessionById(localContext.defaultWorkspaceId, sessionIdForRun);
        if (session && session.status !== 'CREATED') {
          sessionIdForRun = await sessionRepo.createSession(
            localContext.defaultWorkspaceId,
            vehicleId,
            localContext.defaultOperatorId,
            adapterInstanceId,
            routeProfile || 'GENERAL'
          );
          setActiveSessionId(sessionIdForRun);
        }
      } else {
        sessionIdForRun = await sessionRepo.createSession(
          localContext.defaultWorkspaceId,
          vehicleId,
          localContext.defaultOperatorId,
          adapterInstanceId,
          routeProfile || 'GENERAL'
        );
        setActiveSessionId(sessionIdForRun);
      }
      await sessionRepo.beginPreparation(localContext.defaultWorkspaceId, sessionIdForRun);
    } catch (err) {
      setInitError(`SESSION_PREPARATION_FAILED: ${err instanceof Error ? err.message : 'Could not prepare session.'}`);
      attemptStatus.current = 'FAILED';
      return;
    }

    if (adapterMode === 'REPLAY_WS') {
      // LAPTOP REPLAY INITIALIZATION
      try {
        setRealSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
        setCurrentStepIndex(realSteps.length);

        const session = await sessionRepo.getSessionById(localContext.defaultWorkspaceId, sessionIdForRun);
        const monitoringProfile = session?.monitoringProfile || 'GENERAL';

        // Replay fixture supports exactly these signals. 0142 is known to return 7F0112 (Not Supported) in the fixture.
        const replaySupportedCanonicalIds = new Set([
          'ENGINE_RPM',
          'VEHICLE_SPEED',
          'ENGINE_COOLANT',
          'ADAPTER_VOLTAGE',
          'ENGINE_LOAD',
          'MAP'
        ]);

        const resolvedCanonicalIds = resolveDrivingModeSignals(
          monitoringProfile as MonitoringProfile,
          replaySupportedCanonicalIds,
          4
        );

        const ecus: ECUInput[] = [{ address: 0, protocol: 'REPLAY_FIXTURE' }];
        const parameters: ParameterInput[] = resolvedCanonicalIds.map(cId => ({
          ecuAddress: 0,
          parameterDefinitionId: OBD_SIGNAL_REGISTRY[cId]?.command || '',
          supportState: 'SUPPORTED',
          evidenceOrigin: 'REPLAY_FIXTURE',
          discoveryOutcome: 'SUCCESS'
        }));

        const capSnapshot = await capRepo.createSnapshot(
          localContext.defaultWorkspaceId,
          vehicleId,
          adapterInstanceId,
          '1.0',
          'REPLAY_FIXTURE',
          'REPLAY_WS',
          'COMPLETED',
          ecus,
          parameters
        );

        const sigDefs = await productDb.select().from(signalDefinitions).where(inArray(signalDefinitions.signalKey, resolvedCanonicalIds));
        const sigDefMap = new Map(sigDefs.map(row => [row.signalKey, row]));

        const signals = resolvedCanonicalIds.map((canonicalId, index) => {
          const registryEntry = OBD_SIGNAL_REGISTRY[canonicalId];
          const dbDef = sigDefMap.get(canonicalId);
          if (!dbDef) throw new Error(`MISSING_SIGNAL_DEF: ${canonicalId}`);

          const pidStr = registryEntry.command || '';
          return {
            signalDefinitionId: dbDef.id,
            parameterDefinitionId: dbDef.parameterDefinitionId,
            service: pidStr.startsWith('01') ? 1 : 0,
            pid: pidStr.startsWith('01') ? parseInt(pidStr.replace('01', ''), 16) : 0,
            targetEcu: 0,
            effectiveUnit: registryEntry.unit,
            numericType: dbDef.numericType,
            scale: dbDef.scale,
            offset: dbDef.offset,
            precision: dbDef.precision,
            decoderVersion: dbDef.decoderVersion,
            decoderKey: dbDef.decoderKey,
            origin: pidStr === 'ATRV' ? 'ADAPTER' : 'REPLAY_FIXTURE',
            priority: dbDef.defaultPriority,
            targetPeriodMs: 250,
            indexInBlock: index,
            supportState: 'SUPPORTED',
            localTargetIndex: index,
            localSignalIndex: index
          };
        });

        await sessionRepo.attachCapabilitySnapshot(
          localContext.defaultWorkspaceId,
          sessionIdForRun,
          capSnapshot.id,
          '1.0',
          'REPLAY_FIXTURE',
          'LAPTOP_REPLAY'
        );

        await sessionRepo.attachSignalSnapshots(localContext.defaultWorkspaceId, sessionIdForRun, signals);

        // Inject REPLAY_SOURCE_ATTACHED event
        await productDb.insert(liveSessionEvents).values({
          id: ProductIdGenerator.generate(),
          sessionId: sessionIdForRun,
          eventSequence: 9999, // arbitrary large number for synthetic
          eventType: 'REPLAY_SOURCE_ATTACHED',
          source: 'SYSTEM',
          severity: 'INFO',
          timestampMs: Date.now(),
          sessionOffsetMs: 0,
          detailsSchemaVersion: '1.0',
          detailsJson: JSON.stringify({ replayUrl }),
          createdAt: Date.now()
        } as any);

        await sessionRepo.activateSession(localContext.defaultWorkspaceId, sessionIdForRun);

        attemptStatus.current = 'COMPLETED';

        setTimeout(() => {
          navigation.replace('LiveSession', {
            vehicleId,
            sessionId: sessionIdForRun,
            adapterMode: 'REPLAY_WS',
            replayUrl,
            resolvedPollingSet: resolvedCanonicalIds.map(cId => OBD_SIGNAL_REGISTRY[cId]?.command).filter(c => !!c),
            initialAdapterVoltage: '13.8V'
          });
        }, 500);
      } catch (err) {
        setInitError(`REPLAY_INIT_FAILED: ${err instanceof Error ? err.message : 'Could not persist synthetic session activation.'}`);
        attemptStatus.current = 'FAILED';
      }
      return;
    }

    // REAL_BLE INITIALIZATION
    const conn = activeBleController.getConnection(connectionHandleId);
    if (!connectionHandleId || !conn) {
      setInitError('CONNECTION_LOST: Adapter connection handle is missing or no longer active.');
      attemptStatus.current = 'FAILED';
      return;
    }

    try {
      const isActuallyConnected = await conn.device.isConnected();
      if (!isActuallyConnected) {
        activeBleController.releaseConnection();
        setInitError('CONNECTION_LOST: The Bluetooth device disconnected unexpectedly.');
        attemptStatus.current = 'FAILED';
        return;
      }
    } catch (e) {
      setInitError('CONNECTION_LOST: Could not verify Bluetooth device connection status.');
      attemptStatus.current = 'FAILED';
      return;
    }

    const transport = new BleRawTransport(conn);
    const controller = new ObdCommandProcessor(transport);
    
    // Store transport in a ref so we can clean it up if unmounted
    transportRef.current = transport;

    try {
      const initialization = new RealObdInitialization(controller as any, (stepIndex) => {
        setRealSteps(prev => {
          const newSteps = [...prev];
          for (let i = 0; i < stepIndex; i++) {
            newSteps[i].status = 'done';
          }
          if (stepIndex < newSteps.length) {
            newSteps[stepIndex].status = 'pending';
          }
          setCurrentStepIndex(stepIndex);
          return newSteps;
        });
      });

      const snapshot = await initialization.execute();

      if (!snapshot.initializationSuccessful) {
        try {
          await sessionRepo.failSession(localContext.defaultWorkspaceId, sessionIdForRun, 'OBD_INITIALIZATION_FAILED');
        } catch (failErr) {}

        if (snapshot.failureReason?.includes('DISCONNECTED')) {
          setInitError(`CONNECTION_LOST: The adapter disconnected or the communication pipeline was destroyed.\n\nELM327 response: ${snapshot.failureReason}`);
          activeBleController.releaseConnection();
        } else {
          setInitError(`OBD_INITIALIZATION_FAILED: Could not communicate with the vehicle ECU\n\nAdapter connection: OK\nELM327 response: ${snapshot.failureReason || 'UNKNOWN'}`);
        }
        transport.disconnect();
        attemptStatus.current = 'FAILED';
        return;
      }

      setRealSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
      setCurrentStepIndex(realSteps.length);
      let liveSupportedPids = [...snapshot.supportedPids];


        const ecus: ECUInput[] = [{ address: 0, protocol: snapshot.protocol || 'UNKNOWN' }];
        const parameters: ParameterInput[] = snapshot.supportedPids.map(pid => ({
          ecuAddress: 0,
          parameterDefinitionId: pid,
          supportState: 'SUPPORTED',
          evidenceOrigin: snapshot.directlyObservedPids?.includes(pid) ? 'DIRECTLY_OBSERVED' : 'BITMAP',
          discoveryOutcome: 'SUCCESS'
        }));

        if (!snapshot.supportedPids.includes('0142')) {
          parameters.push({
            ecuAddress: 0,
            parameterDefinitionId: '0142',
            supportState: 'UNKNOWN',
            evidenceOrigin: 'PROBE',
            discoveryOutcome: 'NOT_ATTEMPTED'
          });
        }

        let capSnapshot;
        try {
          capSnapshot = await capRepo.createSnapshot(
            localContext.defaultWorkspaceId,
            vehicleId,
            adapterInstanceId,
            '1.0', 
            snapshot.protocol || 'UNKNOWN',
            'BLE',
            'COMPLETED',
            ecus,
            parameters
          );
        } catch (err) {
          try {
            await sessionRepo.failSession(localContext.defaultWorkspaceId, sessionIdForRun, 'CAPABILITY_PERSISTENCE_FAILED');
          } catch (failErr) {}
          setInitError(`CAPABILITY_PERSISTENCE_FAILED: ${err instanceof Error ? err.message : 'Could not persist capabilities.'}`);
          transport.disconnect();
          attemptStatus.current = 'FAILED';
          return;
        }

        try {
          const session = await sessionRepo.getSessionById(localContext.defaultWorkspaceId, sessionIdForRun);
          const monitoringProfile = session?.monitoringProfile || 'GENERAL';

          const availableSignalIds = new Set<string>();
          snapshot.supportedPids.forEach(pid => {
            const entry = Object.values(OBD_SIGNAL_REGISTRY).find(s => s.command === pid);
            if (entry) availableSignalIds.add(entry.canonicalId);
          });
          
          // Assume ADAPTER_VOLTAGE is always available since we communicate with ELM327
          availableSignalIds.add('ADAPTER_VOLTAGE');

          const resolvedCanonicalIds = resolveDrivingModeSignals(
            monitoringProfile as MonitoringProfile,
            availableSignalIds,
            4
          );

          liveSupportedPids = resolvedCanonicalIds.map(cId => OBD_SIGNAL_REGISTRY[cId]?.command).filter(c => !!c) as string[];
          const sigDefs = await productDb.select().from(signalDefinitions).where(inArray(signalDefinitions.signalKey, resolvedCanonicalIds));
          const sigDefMap = new Map(sigDefs.map(row => [row.signalKey, row]));

          const signals = resolvedCanonicalIds.map((canonicalId, index) => {
            const registryEntry = OBD_SIGNAL_REGISTRY[canonicalId];
            const dbDef = sigDefMap.get(canonicalId);
            
            if (!dbDef) {
               throw new Error(`MISSING_SIGNAL_DEF: ${canonicalId} not found in database.`);
            }

            const pidStr = registryEntry.command || '';
            return {
              signalDefinitionId: dbDef.id,
              parameterDefinitionId: dbDef.parameterDefinitionId,
              service: pidStr.startsWith('01') ? 1 : 0,
              pid: pidStr.startsWith('01') ? parseInt(pidStr.replace('01', ''), 16) : 0,
              targetEcu: 0,
              effectiveUnit: registryEntry.unit,
              numericType: dbDef.numericType,
              scale: dbDef.scale,
              offset: dbDef.offset,
              precision: dbDef.precision,
              decoderVersion: dbDef.decoderVersion,
              decoderKey: dbDef.decoderKey,
              origin: pidStr === 'ATRV' ? 'ADAPTER' : (snapshot.directlyObservedPids?.includes(pidStr) ? 'DIRECTLY_OBSERVED' : 'BITMAP'),
              priority: dbDef.defaultPriority,
              targetPeriodMs: 250,
              indexInBlock: index,
              supportState: 'SUPPORTED',
              localTargetIndex: index,
              localSignalIndex: index
            };
          });

          if (signals.length === 0) {
            if (monitoringProfile === 'GENERAL') {
              throw new Error('NO_SUPPORTED_CORE_SIGNALS: ECU responded, but no supported RPM/Speed/Coolant/Voltage signals were available.');
            } else {
              throw new Error(`NO_COMPATIBLE_SIGNALS: No compatible monitoring signals were detected for the ${monitoringProfile} profile on this vehicle.`);
            }
          }

          await sessionRepo.attachCapabilitySnapshot(
            localContext.defaultWorkspaceId,
            sessionIdForRun,
            capSnapshot.id,
            '1.0',
            snapshot.protocol || 'UNKNOWN',
            'REAL_BLE'
          );

          await sessionRepo.attachSignalSnapshots(localContext.defaultWorkspaceId, sessionIdForRun, signals);
          await sessionRepo.activateSession(localContext.defaultWorkspaceId, sessionIdForRun);
        } catch (err) {
          try {
            await sessionRepo.failSession(localContext.defaultWorkspaceId, sessionIdForRun, 'SESSION_ACTIVATION_FAILED');
          } catch (failErr) {}
          setInitError(`SESSION_ACTIVATION_FAILED: ${err instanceof Error ? err.message : 'Could not persist session activation.'}`);
          transport.disconnect();
          attemptStatus.current = 'FAILED';
          return;
        }

      // Transfer ownership of the proven controller to LiveSession via registry
      obdTransportRegistry.register(connectionHandleId, controller);
      transportRef.current = null;
      attemptStatus.current = 'COMPLETED';

      setTimeout(() => {
        navigation.replace('LiveSession', {
          vehicleId,
          sessionId: sessionIdForRun,
          adapterMode: 'REAL_BLE',
          connectionHandleId,
          resolvedPollingSet: liveSupportedPids,
          initialAdapterVoltage: snapshot.adapterIdentity?.supplyVoltage
        });
      }, 500);

    } catch (error) {
      setInitError('OBD_INIT_FAILED: Unexpected error during initialization.');
      transport.disconnect();
      transportRef.current = null;
      attemptStatus.current = 'FAILED';
    }
  }, [activeSessionId, adapterInstanceId, connectionHandleId, navigation, sessionId, vehicleId, realSteps.length, contextLoading, localContext, productDb, adapterMode, replayUrl]);

  useEffect(() => {
    if (adapterMode !== 'VIRTUAL_PREVIEW') return;
    
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
    }
  }, [adapterMode, currentStepIndex, virtualSteps.length]);

  useEffect(() => {
    if (!adapterMode) {
      setInitError('INVALID_SESSION_ORIGIN: Missing adapter mode.');
      return;
    }

    let finishTimer: NodeJS.Timeout | null = null;

    if (adapterMode === 'VIRTUAL_PREVIEW') {
      if (currentStepIndex >= virtualSteps.length) {
        const currentAttemptKey = `${vehicleId}|${adapterMode}|${sessionId || activeSessionId}|${routeProfile || 'GENERAL'}`;
        
        if (attemptStatus.current === 'RUNNING' || attemptStatus.current === 'COMPLETED') {
          if (attemptKey.current === currentAttemptKey) {
            return;
          }
        }

        attemptStatus.current = 'RUNNING';
        attemptKey.current = currentAttemptKey;

        finishTimer = setTimeout(async () => {
          if (attemptStatus.current !== 'RUNNING' || attemptKey.current !== currentAttemptKey) {
            return;
          }

          try {
            const sessionRepo = new LiveSessionRepository(productDb!);
            const capRepo = new CapabilitySnapshotRepository(productDb!);
            
            const profileToUse = routeProfile || 'GENERAL';
            
            const sessionIdForRun = await sessionRepo.createSession(
              localContext!.defaultWorkspaceId, 
              vehicleId, 
              localContext!.defaultOperatorId, 
              'virtual-adapter',
              profileToUse
            );
            
            await sessionRepo.beginPreparation(localContext!.defaultWorkspaceId, sessionIdForRun);

            const virtualSupportedCanonicalIds = new Set([
              'ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'CONTROL_MODULE_VOLTAGE', 'ADAPTER_VOLTAGE', 'ENGINE_LOAD', 'MAP'
            ]);
            const resolvedCanonicalIds = resolveDrivingModeSignals(profileToUse as MonitoringProfile, virtualSupportedCanonicalIds, 4);

            const ecus: ECUInput[] = [{ address: 0, protocol: 'VIRTUAL_FIXTURE' }];
            const parameters: ParameterInput[] = resolvedCanonicalIds.map(cId => ({
              ecuAddress: 0, parameterDefinitionId: OBD_SIGNAL_REGISTRY[cId]?.command || '',
              supportState: 'SUPPORTED', evidenceOrigin: 'REPLAY_FIXTURE', discoveryOutcome: 'SUCCESS'
            }));

            const capSnapshot = await capRepo.createSnapshot(
              localContext!.defaultWorkspaceId, vehicleId, 'virtual-adapter', '1.0', 'VIRTUAL_FIXTURE', 'VIRTUAL_PREVIEW', 'COMPLETED', ecus, parameters
            );

            const sigDefs = await productDb!.select().from(signalDefinitions).where(inArray(signalDefinitions.signalKey, resolvedCanonicalIds));
            const sigDefMap = new Map(sigDefs.map(row => [row.signalKey, row]));

            const signals = resolvedCanonicalIds.map((canonicalId, index) => {
              const registryEntry = OBD_SIGNAL_REGISTRY[canonicalId];
              const dbDef = sigDefMap.get(canonicalId);
              if (!dbDef) throw new Error(`MISSING_SIGNAL_DEF: ${canonicalId}`);
              const pidStr = registryEntry.command || '';
              return {
                signalDefinitionId: dbDef.id, parameterDefinitionId: dbDef.parameterDefinitionId,
                service: pidStr.startsWith('01') ? 1 : 0, pid: pidStr.startsWith('01') ? parseInt(pidStr.replace('01', ''), 16) : 0,
                targetEcu: 0, effectiveUnit: registryEntry.unit, numericType: dbDef.numericType,
                scale: dbDef.scale, offset: dbDef.offset, precision: dbDef.precision, decoderVersion: dbDef.decoderVersion,
                decoderKey: dbDef.decoderKey, origin: pidStr === 'ATRV' ? 'ADAPTER' : 'REPLAY_FIXTURE',
                priority: dbDef.defaultPriority, targetPeriodMs: 250, indexInBlock: index, supportState: 'SUPPORTED',
                localTargetIndex: index, localSignalIndex: index
              };
            });

            console.log(`[VIRTUAL CREATE]`);
            console.log(`sessionId=${sessionIdForRun}`);
            console.log(`profile=${profileToUse}`);
            console.log(`resolvedSignals=${resolvedCanonicalIds.join(',')}`);

            await sessionRepo.attachCapabilitySnapshot(localContext!.defaultWorkspaceId, sessionIdForRun, capSnapshot.id, '1.0', 'VIRTUAL_FIXTURE', 'VIRTUAL_PREVIEW');
            await sessionRepo.attachSignalSnapshots(localContext!.defaultWorkspaceId, sessionIdForRun, signals);
            await sessionRepo.activateSession(localContext!.defaultWorkspaceId, sessionIdForRun);

            attemptStatus.current = 'COMPLETED';
            console.log(`[LIVE NAV] nav from InitializationScreen sessionId=${sessionIdForRun}`);
            navigation.replace('LiveSession', { vehicleId, sessionId: sessionIdForRun, adapterMode: 'VIRTUAL_PREVIEW' });
          } catch (e) {
             attemptStatus.current = 'FAILED';
             setInitError('VIRTUAL_INIT_FAILED: ' + (e as Error).message);
          }
        }, 500);
      }
    } else if (adapterMode === 'REAL_BLE' || adapterMode === 'REPLAY_WS') {
      if (!contextLoading && !initError) {
        executeInitialization().catch(err => {
          console.error('Unhandled Rejection in executeInitialization:', err);
        });
      }
    } else {
       setInitError(`INVALID_SESSION_ORIGIN: Unknown adapter mode ${adapterMode}`);
    }

    // Cleanup function: If the screen unmounts, forcefully drop the discovery BLE subscription
    return () => {
      if (finishTimer) {
        clearTimeout(finishTimer);
      }
      if (attemptStatus.current === 'RUNNING') {
        attemptStatus.current = 'CANCELLED';
      }
      if (transportRef.current) {
        transportRef.current.disconnect();
        transportRef.current = null;
      }
    };
  }, [adapterMode, executeInitialization, initError, navigation, sessionId, vehicleId, contextLoading, currentStepIndex >= virtualSteps.length]);

  const handleRetry = () => {
    if (attemptStatus.current === 'RUNNING') return;
    setRealSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
    setCurrentStepIndex(0);
    attemptStatus.current = 'IDLE';
    attemptKey.current = '';
    setInitError(null);
  };

  const activeSteps = (adapterMode === 'REAL_BLE' || adapterMode === 'REPLAY_WS') ? realSteps : virtualSteps;

  if (initError) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning" size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>{initError}</Text>

        {(adapterMode === 'REAL_BLE' || adapterMode === 'REPLAY_WS') && (
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
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
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
