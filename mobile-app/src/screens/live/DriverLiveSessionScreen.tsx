import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import LiveSessionScreen from './LiveSessionScreen';
import { DriverModeSelector } from './components/DriverModeSelector';
import { DriverModeProvider, useDriverMode } from './components/DriverModeContext';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { ElmBleDiagnosticConnector } from '../../infrastructure/diagnostics/ElmBleDiagnosticConnector';
import { characterizeRuntimeCompatibility } from '../../application/diagnostics/RuntimeCompatibilityCharacterization';
import { runtimeCompatibilityStore } from '../../application/diagnostics/RuntimeCompatibilityStore';

function DriverModePanel() {
  const { selectedMode, setSelectedMode, availableSignals } = useDriverMode();

  return (
    <View style={styles.modePanel}>
      <DriverModeSelector
        selectedMode={selectedMode}
        availableSignals={availableSignals}
        onSelectMode={setSelectedMode}
      />
    </View>
  );
}

function DriverLiveSessionContent() {
  return (
    <View style={styles.container}>
      <DriverModePanel />
      <View style={styles.liveContainer}>
        <LiveSessionScreen />
      </View>
    </View>
  );
}

export default function DriverLiveSessionScreen() {
  const route = useRoute<any>();
  const supportedPids = route.params?.supportedPids || [];
  const sessionId = route.params?.sessionId as string | undefined;
  const vehicleId = route.params?.vehicleId as string | undefined;
  const adapterMode = route.params?.adapterMode as string | undefined;
  const connectionHandleId = route.params?.connectionHandleId as string | undefined;
  const [characterizationComplete, setCharacterizationComplete] = useState(adapterMode !== 'REAL_BLE');

  useEffect(() => {
    if (adapterMode !== 'REAL_BLE' || !connectionHandleId || !sessionId) {
      setCharacterizationComplete(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const connection = activeBleController.getConnection(connectionHandleId);
      if (!connection) {
        setCharacterizationComplete(true);
        return;
      }

      const controller = new RealObdController(connection);
      const connector = new ElmBleDiagnosticConnector(controller);

      try {
        // Initialization leaves headers disabled for normal polling. Temporarily
        // enable them so responding ECU addresses can be preserved as evidence.
        await connector.execute({
          id: `characterize-headers-on-${sessionId}`,
          payload: 'ATH1',
          kind: 'ADAPTER_CONTROL',
          timeoutMs: 3000,
        });

        const snapshot = await characterizeRuntimeCompatibility({
          connector,
          vehicle: { vehicleId },
        });

        if (!cancelled) {
          runtimeCompatibilityStore.set(sessionId, snapshot);
        }
      } catch (error) {
        // Characterization enriches the product but is never allowed to turn a
        // successfully initialized OBD session into a failed Live session.
        console.warn('[DriverLiveSession] Compatibility characterization degraded:', error);
      } finally {
        try {
          await connector.execute({
            id: `characterize-headers-off-${sessionId}`,
            payload: 'ATH0',
            kind: 'ADAPTER_CONTROL',
            timeoutMs: 3000,
          });
        } catch (error) {
          console.warn('[DriverLiveSession] Could not restore header preference:', error);
        }

        if (!cancelled) setCharacterizationComplete(true);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [adapterMode, connectionHandleId, sessionId, vehicleId]);

  if (!characterizationComplete) {
    return (
      <View style={styles.characterizationContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.characterizationTitle}>Checking vehicle…</Text>
        <Text style={styles.characterizationText}>
          Live data will start when the read-only compatibility scan is complete.
        </Text>
      </View>
    );
  }

  return (
    <DriverModeProvider supportedPids={supportedPids}>
      <DriverLiveSessionContent />
    </DriverModeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1417',
  },
  modePanel: {
    backgroundColor: '#0e1417',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  liveContainer: {
    flex: 1,
  },
  characterizationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#0e1417',
  },
  characterizationTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  characterizationText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#94a3b8',
  },
});
