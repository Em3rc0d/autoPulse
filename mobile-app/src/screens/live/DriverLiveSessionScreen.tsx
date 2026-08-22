import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import LiveSessionScreen from './LiveSessionScreen';
import { DriverModeSelector } from './components/DriverModeSelector';
import { DriverModeProvider, useDriverMode } from './components/DriverModeContext';
import { PhoneSensorBridge } from './components/PhoneSensorBridge';
import { DriverContextualIntelligence } from './components/DriverContextualIntelligence';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { ElmBleDiagnosticConnector } from '../../infrastructure/diagnostics/ElmBleDiagnosticConnector';
import { speakDriverMessage } from '../../infrastructure/voice/AndroidDriverVoice';
import { characterizeRuntimeCompatibility } from '../../application/diagnostics/RuntimeCompatibilityCharacterization';
import { runtimeCompatibilityStore } from '../../application/diagnostics/RuntimeCompatibilityStore';
import { persistCompatibilitySnapshot } from '../../application/diagnostics/CompatibilityPersistence';
import { loadVehicleDocuments } from '../../application/driver-intelligence/VehicleDocumentPersistence';
import {
  createDriverVoiceMemory,
  decideAdvisoryVoice,
  evaluateDriverAdvisories,
  markAdvisorySpoken,
  vehicleHealthFromCompatibility,
  type DriverAdvisory,
} from '../../domain/driver-intelligence';

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
      <PhoneSensorBridge />
      <DriverContextualIntelligence />
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
  const [advisories, setAdvisories] = useState<DriverAdvisory[]>([]);
  const voiceMemory = useRef(createDriverVoiceMemory());

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
          try {
            await persistCompatibilitySnapshot(sessionId, snapshot);
          } catch (error) {
            console.warn('[DriverLiveSession] Compatibility persistence degraded:', error);
          }

          const documents = vehicleId ? await loadVehicleDocuments(vehicleId) : [];
          const health = vehicleHealthFromCompatibility(snapshot);
          const nextAdvisories = evaluateDriverAdvisories({
            health,
            documents,
            nowMs: Date.now(),
          });
          setAdvisories(nextAdvisories);

          for (const advisory of nextAdvisories) {
            const decision = decideAdvisoryVoice(advisory, voiceMemory.current, Date.now());
            if (!decision.shouldSpeak || !decision.message) continue;
            const spoken = await speakDriverMessage(decision.message);
            if (spoken) {
              voiceMemory.current = markAdvisorySpoken(voiceMemory.current, advisory.id, Date.now());
            }
          }
        }
      } catch (error) {
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

  const visibleAdvisory = advisories[0];

  return (
    <View style={styles.container}>
      {visibleAdvisory ? (
        <View style={[
          styles.advisoryBanner,
          visibleAdvisory.severity === 'WARNING' || visibleAdvisory.severity === 'CRITICAL'
            ? styles.advisoryBannerWarning
            : styles.advisoryBannerNotice,
        ]}>
          <Text style={styles.advisoryTitle}>{visibleAdvisory.title}</Text>
          <Text style={styles.advisoryMessage}>{visibleAdvisory.shortMessage}</Text>
        </View>
      ) : null}
      <DriverModeProvider supportedPids={supportedPids}>
        <DriverLiveSessionContent />
      </DriverModeProvider>
    </View>
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
  advisoryBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  advisoryBannerWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  advisoryBannerNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  advisoryTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  advisoryMessage: {
    marginTop: 3,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
});
