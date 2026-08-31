import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, Vibration, View } from 'react-native';
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
import { speakDriverMessage } from '../../infrastructure/voice/AndroidDriverVoice';
import { characterizeRuntimeCompatibility } from '../../application/diagnostics/RuntimeCompatibilityCharacterization';
import { runtimeCompatibilityStore } from '../../application/diagnostics/RuntimeCompatibilityStore';
import { persistCompatibilitySnapshot } from '../../application/diagnostics/CompatibilityPersistence';
import {
  buildPhysicalValidationReceipt,
  persistPhysicalValidationReceipt,
} from '../../application/diagnostics/PhysicalValidationReceipt';
import { loadVehicleDocuments } from '../../application/driver-intelligence/VehicleDocumentPersistence';
import { DEFAULT_DRIVER_PREFERENCES, loadDriverPreferences, type DriverPreferences } from '../../application/settings/DriverPreferences';
import type { LiveSessionTerminalOutcome } from '../../application/live/RealLiveSessionController';
import {
  evaluateDriverAdvisories,
  vehicleHealthFromCompatibility,
  type DriverAdvisory,
} from '../../domain/driver-intelligence';
import {
  DRIVER_ALERT_LEXICON,
  driverAlertPhrase,
  type DriverAlertDefinition,
} from '../../domain/driver-intelligence/DriverAlertLexicon';
import {
  markLiveAlertSpoken,
  selectCoolantDriverAlert,
  shouldSpeakLiveAlert,
  type LiveDriverAlertMemory,
} from '../../domain/driver-intelligence/LiveDriverAlertPolicy';

const DRIVING_PRESENTATION_SPEED_KMH = 5;
const OBSERVATION_FRESHNESS_MS = 5_000;

function DriverModePanel({ disabled, compact = false }: { disabled: boolean; compact?: boolean }) {
  const { selectedMode, setSelectedMode, availableSignals } = useDriverMode();
  return (
    <View style={[styles.modePanel, compact && styles.modePanelCompact]}>
      <DriverModeSelector
        selectedMode={selectedMode}
        availableSignals={availableSignals}
        onSelectMode={setSelectedMode}
        disabled={disabled}
        compact={compact}
      />
    </View>
  );
}

function alertTone(alert: DriverAlertDefinition | null) {
  switch (alert?.severity) {
    case 'S3_CRITICAL': return { background: '#3a0d12', border: '#ef4444', text: '#fecaca' };
    case 'S2_ATTENTION': return { background: '#3a1f08', border: '#f97316', text: '#fed7aa' };
    case 'S1_ADVISORY': return { background: '#332708', border: '#f59e0b', text: '#fde68a' };
    default: return { background: '#0d2b1c', border: '#22c55e', text: '#bbf7d0' };
  }
}

function DrivingPresentationSurface({ alert }: { alert: DriverAlertDefinition | null }) {
  const { observations } = useDriverMode();
  const coolant = observations.ENGINE_COOLANT;
  const speed = observations.VEHICLE_SPEED;
  const rpm = observations.ENGINE_RPM;
  const tone = alertTone(alert);

  const headline = alert ? driverAlertPhrase(alert.key, 'en-US').replace(/\.$/, '') : 'NORMAL';
  const icon = alert?.icon ?? '●';

  return (
    <View style={styles.drivingSurface} testID="driving-presentation">
      <View style={[styles.drivingState, { backgroundColor: tone.background, borderColor: tone.border }]}>
        <Text style={[styles.drivingIcon, { color: tone.border }]}>{icon}</Text>
        <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.drivingHeadline, { color: tone.text }]}>{headline}</Text>
      </View>

      <View style={styles.primaryMetric}>
        <Text style={styles.primaryValue}>{typeof coolant?.value === 'number' ? Math.round(coolant.value) : '—'}</Text>
        <Text style={styles.primaryUnit}>°C</Text>
        <Text style={styles.primaryLabel}>ENGINE TEMP</Text>
      </View>

      <View style={styles.drivingSecondaryRow}>
        <View style={styles.secondaryMetric}>
          <Text style={styles.secondaryValue}>{typeof speed?.value === 'number' ? Math.round(speed.value) : '—'}</Text>
          <Text style={styles.secondaryLabel}>KM/H</Text>
        </View>
        <View style={styles.secondaryDivider} />
        <View style={styles.secondaryMetric}>
          <Text style={styles.secondaryValue}>{typeof rpm?.value === 'number' ? Math.round(rpm.value) : '—'}</Text>
          <Text style={styles.secondaryLabel}>RPM</Text>
        </View>
      </View>

      <Text style={styles.drivingHint}>Eyes on the road · voice alerts active</Text>
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
  const [preferences, setPreferences] = useState<DriverPreferences>(DEFAULT_DRIVER_PREFERENCES);
  const { observations } = useDriverMode();
  const liveVoiceMemory = useRef<LiveDriverAlertMemory>({});

  useEffect(() => {
    let mounted = true;
    void loadDriverPreferences().then(next => { if (mounted) setPreferences(next); });
    return () => { mounted = false; };
  }, []);

  const now = Date.now();
  const speedObservation = observations.VEHICLE_SPEED;
  const speedFresh = Boolean(
    speedObservation &&
    speedObservation.quality === 'VALID' &&
    now - speedObservation.observedAt <= OBSERVATION_FRESHNESS_MS,
  );
  const isDriving = Boolean(speedFresh && speedObservation.value >= DRIVING_PRESENTATION_SPEED_KMH && !terminalOutcome);

  const coolantObservation = observations.ENGINE_COOLANT;
  const liveAlert = useMemo(() => {
    if (!coolantObservation?.advisory) return null;
    return selectCoolantDriverAlert({
      quality: coolantObservation.quality === 'VALID' ? 'VALID' : coolantObservation.quality === 'STALE' ? 'STALE' : 'UNAVAILABLE',
      advisory: coolantObservation.advisory,
    }, Number.isFinite(coolantObservation.value));
  }, [coolantObservation?.advisory, coolantObservation?.quality, coolantObservation?.value]);

  const scanAdvisory = advisories.find(item =>
    (item.id.startsWith('health:') || item.id.startsWith('dtc:')) &&
    (item.severity === 'WARNING' || item.severity === 'CRITICAL'),
  );
  const scanAlert = scanAdvisory ? DRIVER_ALERT_LEXICON.CHECK_ENGINE : null;
  const effectiveAlert = liveAlert ?? scanAlert;

  useEffect(() => {
    if (!effectiveAlert || terminalOutcome) return;
    const spokenAt = Date.now();
    if (!shouldSpeakLiveAlert(effectiveAlert, preferences, liveVoiceMemory.current, spokenAt)) return;

    const phrase = driverAlertPhrase(effectiveAlert.key, preferences.voiceLanguage);
    void speakDriverMessage(phrase, preferences.voiceLanguage).then(spoken => {
      if (!spoken) return;
      liveVoiceMemory.current = markLiveAlertSpoken(effectiveAlert, spokenAt);
      if (effectiveAlert.severity === 'S3_CRITICAL') Vibration.vibrate([0, 180, 90, 180]);
      else if (effectiveAlert.severity === 'S2_ATTENTION') Vibration.vibrate(120);
    });
  }, [effectiveAlert?.key, effectiveAlert?.severity, preferences, terminalOutcome]);

  return (
    <View style={styles.container}>
      {!terminalOutcome ? <DriverModePanel disabled={false} compact={isDriving} /> : null}

      {isDriving ? (
        <DrivingPresentationSurface alert={effectiveAlert} />
      ) : (
        <>
          {!terminalOutcome ? <DriverStartupCoordinator diagnosticScanComplete advisories={advisories} /> : null}
          {!terminalOutcome ? <DriverContextualIntelligence /> : null}
        </>
      )}

      <View style={isDriving ? styles.hiddenLiveContainer : styles.liveContainer} pointerEvents={isDriving ? 'none' : 'auto'}>
        <LiveSessionScreen
          supplement={!terminalOutcome && !isDriving ? <PhoneSensorBridge vehicleId={vehicleId} /> : null}
          onTerminalStateChange={setTerminalOutcome}
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
  return (
    <View style={styles.container}>
      {visibleAdvisory ? (
        <View style={[
          styles.advisoryBanner,
          visibleAdvisory.severity === 'WARNING' || visibleAdvisory.severity === 'CRITICAL'
            ? styles.advisoryBannerWarning : styles.advisoryBannerNotice,
        ]}>
          <View style={styles.advisoryIndicator} />
          <Text numberOfLines={1} style={styles.advisoryLine}>
            <Text style={styles.advisoryTitle}>{visibleAdvisory.title} · </Text>
            {visibleAdvisory.shortMessage}
          </Text>
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
  modePanelCompact: { paddingTop: 3, paddingBottom: 0 },
  liveContainer: { flex: 1 },
  hiddenLiveContainer: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, bottom: 0, overflow: 'hidden' },
  characterizationContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#0b1114' },
  characterizationTitle: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  characterizationText: { marginTop: 6, textAlign: 'center', fontSize: 12, lineHeight: 18, color: '#94a3b8' },
  advisoryBanner: { minHeight: 38, marginHorizontal: 10, marginTop: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  advisoryBannerWarning: { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.55)' },
  advisoryBannerNotice: { backgroundColor: 'rgba(245, 158, 11, 0.10)', borderColor: 'rgba(245, 158, 11, 0.45)' },
  advisoryIndicator: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 8 },
  advisoryLine: { flex: 1, color: '#e2e8f0', fontSize: 11, fontWeight: '600' },
  advisoryTitle: { color: '#f8fafc', fontWeight: '800' },
  drivingSurface: { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, justifyContent: 'center' },
  drivingState: { minHeight: 74, borderRadius: 18, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  drivingIcon: { fontSize: 30, marginRight: 12, fontWeight: '900' },
  drivingHeadline: { flexShrink: 1, fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  primaryMetric: { alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  primaryValue: { color: '#f8fafc', fontSize: 70, lineHeight: 74, fontWeight: '900', fontVariant: ['tabular-nums'] },
  primaryUnit: { color: '#94a3b8', fontSize: 19, fontWeight: '800', marginTop: -6 },
  primaryLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginTop: 7 },
  drivingSecondaryRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#11191d', borderRadius: 15, borderWidth: 1, borderColor: '#263239' },
  secondaryMetric: { flex: 1, alignItems: 'center' },
  secondaryValue: { color: '#e2e8f0', fontSize: 25, fontWeight: '900', fontVariant: ['tabular-nums'] },
  secondaryLabel: { color: '#64748b', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  secondaryDivider: { width: 1, height: 34, backgroundColor: '#334155' },
  drivingHint: { color: '#64748b', fontSize: 9, textAlign: 'center', marginTop: 10, letterSpacing: 0.3 },
});
