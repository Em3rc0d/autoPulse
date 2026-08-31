import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import LiveSessionScreen from './LiveSessionScreen';
import { DriverModeSelector } from './components/DriverModeSelector';
import { DriverModeProvider, useDriverMode } from './components/DriverModeContext';
import { PhoneSensorBridge } from './components/PhoneSensorBridge';
import { DriverContextualIntelligence } from './components/DriverContextualIntelligence';
import { DriverStartupCoordinator } from './components/DriverStartupCoordinator';
import { activeBleController } from '../../infrastructure/ble/ActiveBleConnectionController';
import { RealObdController } from '../../infrastructure/ble/real/RealObdController';
import { ElmBleDiagnosticConnector } from '../../infrastructure/diagnostics/ElmBleDiagnosticConnector';
import { speakDriverAlert, speakDriverMessage } from '../../infrastructure/voice/AndroidDriverVoice';
import { characterizeRuntimeCompatibility } from '../../application/diagnostics/RuntimeCompatibilityCharacterization';
import { runtimeCompatibilityStore } from '../../application/diagnostics/RuntimeCompatibilityStore';
import { persistCompatibilitySnapshot } from '../../application/diagnostics/CompatibilityPersistence';
import {
  buildPhysicalValidationReceipt,
  persistPhysicalValidationReceipt,
} from '../../application/diagnostics/PhysicalValidationReceipt';
import { loadVehicleDocuments } from '../../application/driver-intelligence/VehicleDocumentPersistence';
import type { LiveSessionTerminalOutcome } from '../../application/live/RealLiveSessionController';
import {
  createDriverVoiceMemory,
  decideAdvisoryVoice,
  evaluateDriverAdvisories,
  markAdvisorySpoken,
  vehicleHealthFromCompatibility,
  type DriverAdvisory,
} from '../../domain/driver-intelligence';

function DriverModePanel({ disabled }: { disabled: boolean }) {
  const { selectedMode, setSelectedMode, availableSignals } = useDriverMode();
  return (
    <View style={styles.modePanel}>
      <DriverModeSelector
        selectedMode={selectedMode}
        availableSignals={availableSignals}
        onSelectMode={setSelectedMode}
        disabled={disabled}
      />
    </View>
  );
}

function DriverLiveSessionContent({
  advisories,
  vehicleId,
}: {
  advisories: readonly DriverAdvisory[];
  vehicleId?: string;
}) {
  const [terminalOutcome, setTerminalOutcome] = useState<LiveSessionTerminalOutcome | null>(null);
  const [isDriving, setIsDriving] = useState(false);

  return (
    <View style={styles.container}>
      {!terminalOutcome && !isDriving ? <DriverModePanel disabled={false} /> : null}
      {!terminalOutcome && !isDriving ? <DriverStartupCoordinator diagnosticScanComplete advisories={advisories} /> : null}
      {!terminalOutcome && !isDriving ? <DriverContextualIntelligence /> : null}
      <View style={styles.liveContainer}>
        <LiveSessionScreen
          supplement={!terminalOutcome && !isDriving ? <PhoneSensorBridge vehicleId={vehicleId} /> : null}
          onTerminalStateChange={setTerminalOutcome}
          onDrivingStateChange={setIsDriving}
        />
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

        const snapshot = await characterizeRuntimeCompatibility({ connector, vehicle: { vehicleId } });

        if (!cancelled) {
          runtimeCompatibilityStore.set(sessionId, snapshot);
          try {
            await persistCompatibilitySnapshot(sessionId, snapshot);
          } catch (error) {
            console.warn('[DriverLiveSession] Compatibility persistence degraded:', error);
          }

          const documents = vehicleId ? await loadVehicleDocuments(vehicleId) : [];
          const health = vehicleHealthFromCompatibility(snapshot);
          const nextAdvisories = evaluateDriverAdvisories({ health, documents, nowMs: Date.now() });
          setAdvisories(nextAdvisories);

          try {
            await persistPhysicalValidationReceipt(buildPhysicalValidationReceipt({
              sessionId,
              vehicleId,
              compatibility: snapshot,
              health,
              documents,
              advisories: nextAdvisories,
            }));
          } catch (error) {
            console.warn('[DriverLiveSession] Physical validation receipt persistence degraded:', error);
          }

          for (const advisory of nextAdvisories) {
            const decision = decideAdvisoryVoice(advisory, voiceMemory.current, Date.now());
            if (!decision.shouldSpeak || !decision.message) continue;
            const spoken = advisory.voiceKey
              ? await speakDriverAlert(advisory.voiceKey)
              : await speakDriverMessage(decision.message);
            if (spoken) voiceMemory.current = markAdvisorySpoken(voiceMemory.current, advisory.id, Date.now());
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
        } finally {
          controller.disconnect();
        }

        if (!cancelled) setCharacterizationComplete(true);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [adapterMode, connectionHandleId, sessionId, vehicleId]);

  if (!characterizationComplete) {
    return (
      <View style={styles.characterizationContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.characterizationTitle}>Checking vehicle…</Text>
        <Text style={styles.characterizationText}>Read-only compatibility and diagnostic scan.</Text>
      </View>
    );
  }

  const visibleAdvisory = advisories[0];
  const advisoryCritical = visibleAdvisory?.severity === 'CRITICAL';
  const advisoryWarning = visibleAdvisory?.severity === 'WARNING';

  return (
    <View style={styles.container}>
      {visibleAdvisory ? (
        <View style={[
          styles.advisoryBanner,
          advisoryCritical
            ? styles.advisoryBannerCritical
            : advisoryWarning
              ? styles.advisoryBannerWarning
              : styles.advisoryBannerNotice,
        ]}>
          <Text style={styles.advisoryMark}>{advisoryCritical ? '!' : advisoryWarning ? '▲' : '●'}</Text>
          <Text numberOfLines={1} style={styles.advisoryTitle}>{visibleAdvisory.title}</Text>
        </View>
      ) : null}
      <DriverModeProvider supportedPids={supportedPids}>
        <DriverLiveSessionContent advisories={advisories} vehicleId={vehicleId} />
      </DriverModeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  modePanel: { backgroundColor: '#0b1114', paddingHorizontal: 12, paddingTop: 6 },
  liveContainer: { flex: 1 },
  characterizationContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#0b1114' },
  characterizationTitle: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  characterizationText: { marginTop: 6, textAlign: 'center', fontSize: 12, lineHeight: 18, color: '#94a3b8' },
  advisoryBanner: {
    minHeight: 36,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  advisoryBannerCritical: { backgroundColor: 'rgba(239, 68, 68, 0.18)', borderColor: '#ef4444' },
  advisoryBannerWarning: { backgroundColor: 'rgba(249, 115, 22, 0.14)', borderColor: '#f97316' },
  advisoryBannerNotice: { backgroundColor: 'rgba(245, 158, 11, 0.10)', borderColor: 'rgba(245, 158, 11, 0.55)' },
  advisoryMark: { width: 20, color: '#f8fafc', fontSize: 13, fontWeight: '900', marginRight: 6 },
  advisoryTitle: { flex: 1, color: '#f8fafc', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
