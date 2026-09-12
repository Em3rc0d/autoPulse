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
  type DriverAlertSeverity,
} from '../../domain/driver-intelligence/DriverAlertLexicon';
import {
  markLiveAlertSpoken,
  selectCoolantDriverAlert,
  shouldSpeakLiveAlert,
  type LiveDriverAlertMemory,
} from '../../domain/driver-intelligence/LiveDriverAlertPolicy';
import {
  initialMotionState,
  resolveMotionState,
  type MotionEvidence,
  type MotionState,
} from '../../domain/driver-intelligence/MotionStatePolicy';
import { isTrustedFor } from '../../domain/driver-intelligence/DrivingEvidenceTrust';
import {
  resolveDrivingModePresentation,
  type DrivingModePresentation,
  type ResolvedDrivingMetric,
} from '../../domain/driver-intelligence/DrivingModeResolverV2';
import {
  INACTIVE_ALERT_EPISODE,
  advanceAlertLifecycle,
  lifecyclePresentationAlert,
  type AlertEpisode,
} from '../../domain/driver-intelligence/DriverAlertLifecycle';

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

function toneForSeverity(severity?: DriverAlertSeverity) {
  switch (severity) {
    case 'S3_CRITICAL': return { background: '#3a0d12', border: '#ef4444', text: '#fecaca' };
    case 'S2_ATTENTION': return { background: '#3a1f08', border: '#f97316', text: '#fed7aa' };
    case 'S1_ADVISORY': return { background: '#332708', border: '#f59e0b', text: '#fde68a' };
    default: return { background: '#0d2b1c', border: '#22c55e', text: '#bbf7d0' };
  }
}

function formatMetric(metric?: ResolvedDrivingMetric) {
  if (!metric) return { value: '—', unit: '', label: '' };
  const decimal = metric.signalId === 'CONTROL_VOLTAGE' || metric.signalId === 'ADAPTER_VOLTAGE'
    || metric.signalId === 'PITCH' || metric.signalId === 'ROLL';
  const value = decimal ? metric.value.toFixed(1) : Math.round(metric.value).toString();
  return { value, unit: metric.unit ?? '', label: metric.label };
}

function SafetyOrModePrimary({
  alert,
  unresolved,
  presentation,
}: {
  alert: DriverAlertDefinition | null;
  unresolved: boolean;
  presentation: DrivingModePresentation;
}) {
  if (unresolved) {
    return (
      <View style={styles.primaryMetric}>
        <Text style={styles.primaryStateText}>SIGNAL LOST</Text>
        <Text style={styles.primaryLabel}>RECOVERY NOT CONFIRMED</Text>
      </View>
    );
  }

  if (alert?.key === 'ENGINE_HOT' || alert?.key === 'TEMP_RISING') {
    const thermal = presentation.evidenceByDimension.THERMAL;
    const coolant = thermal?.signalId === 'ENGINE_COOLANT' ? thermal : undefined;
    if (coolant) {
      const formatted = formatMetric(coolant);
      return (
        <View style={styles.primaryMetric}>
          <View style={styles.primaryInline}>
            <Text style={styles.primaryValue}>{formatted.value}</Text>
            <Text style={styles.primaryUnit}>{formatted.unit}</Text>
          </View>
          <Text style={styles.primaryLabel}>{formatted.label}</Text>
        </View>
      );
    }
  }

  if (presentation.stateFirst && !alert) {
    const stateLabel = presentation.mode === 'FAMILY' && presentation.readiness === 'READY'
      ? 'ALL CLEAR'
      : 'NO ACTIVE ALERTS';
    return (
      <View style={styles.primaryMetric}>
        <Text numberOfLines={2} adjustsFontSizeToFit style={styles.primaryStateText}>{stateLabel}</Text>
        <Text style={styles.primaryLabel}>{presentation.readiness} EVIDENCE</Text>
      </View>
    );
  }

  const formatted = formatMetric(presentation.primary);
  return (
    <View style={styles.primaryMetric}>
      <View style={styles.primaryInline}>
        <Text style={styles.primaryValue}>{formatted.value}</Text>
        {formatted.unit ? <Text style={styles.primaryUnit}>{formatted.unit}</Text> : null}
      </View>
      <Text style={styles.primaryLabel}>{formatted.label || presentation.readiness}</Text>
    </View>
  );
}

function SecondaryMetric({ metric }: { metric?: ResolvedDrivingMetric }) {
  const formatted = formatMetric(metric);
  return (
    <View style={styles.secondaryMetric}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.secondaryValue}>
        {formatted.value}{formatted.unit ? ` ${formatted.unit}` : ''}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.secondaryLabel}>{formatted.label || 'NO EVIDENCE'}</Text>
    </View>
  );
}

function DrivingPresentationSurface({
  alert,
  alertEpisode,
  motionState,
  presentation,
  voiceEnabled,
}: {
  alert: DriverAlertDefinition | null;
  alertEpisode: AlertEpisode;
  motionState: MotionState;
  presentation: DrivingModePresentation;
  voiceEnabled: boolean;
}) {
  const unresolved = alertEpisode.state === 'UNRESOLVED';
  const severity = unresolved ? alertEpisode.peakSeverity : alert?.severity;
  const visualSeverity = severity ?? (motionState === 'UNKNOWN' ? 'S1_ADVISORY' : undefined);
  const tone = toneForSeverity(visualSeverity);
  const headline = alert
    ? driverAlertPhrase(alert.key, 'en-US').replace(/\.$/, '')
    : unresolved
      ? 'CONDITION UNRESOLVED'
      : motionState === 'UNKNOWN'
        ? 'TELEMETRY DEGRADED'
        : 'NORMAL';
  const icon = alert?.icon ?? (unresolved || motionState === 'UNKNOWN' ? '▲' : '●');
  const secondaryA = presentation.stateFirst ? presentation.primary : presentation.secondaryA;
  const secondaryB = presentation.stateFirst ? presentation.secondaryA : presentation.secondaryB;
  const fullSafetyOverride = severity === 'S3_CRITICAL' || unresolved && alertEpisode.peakSeverity === 'S3_CRITICAL';

  return (
    <View style={styles.drivingSurface} testID="driving-presentation-v2">
      <View style={[styles.drivingState, { backgroundColor: tone.background, borderColor: tone.border }]}>
        <Text style={[styles.drivingIcon, { color: tone.border }]}>{icon}</Text>
        <View style={styles.drivingStateCopy}>
          <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.drivingHeadline, { color: tone.text }]}>{headline}</Text>
          <Text style={styles.drivingStateMeta}>
            {motionState === 'UNKNOWN' ? 'MOTION UNKNOWN · ' : ''}{presentation.readiness}
          </Text>
        </View>
      </View>

      <SafetyOrModePrimary alert={alert} unresolved={unresolved} presentation={presentation} />

      {!fullSafetyOverride ? (
        <View style={styles.drivingSecondaryRow}>
          <SecondaryMetric metric={secondaryA} />
          <View style={styles.secondaryDivider} />
          <SecondaryMetric metric={secondaryB} />
        </View>
      ) : (
        <View style={styles.safetyOverrideFooter}>
          <Text style={styles.safetyOverrideText}>SAFETY OVERRIDE · MODE PRESERVED</Text>
        </View>
      )}

      <Text style={styles.drivingHint}>
        Eyes on the road · {voiceEnabled ? 'voice alerts active' : 'voice alerts off'}
      </Text>
    </View>
  );
}

function LowDistractionTerminalSurface({ outcome }: { outcome: LiveSessionTerminalOutcome }) {
  return (
    <View style={styles.drivingSurface} testID="terminal-low-distraction">
      <View style={[styles.drivingState, { backgroundColor: '#332708', borderColor: '#f59e0b' }]}>
        <Text style={[styles.drivingIcon, { color: '#f59e0b' }]}>▲</Text>
        <View style={styles.drivingStateCopy}>
          <Text style={[styles.drivingHeadline, { color: '#fde68a' }]}>SESSION {outcome.state}</Text>
          <Text numberOfLines={1} style={styles.drivingStateMeta}>{outcome.reason ?? 'TELEMETRY ENDED'}</Text>
        </View>
      </View>
      <View style={styles.primaryMetric}>
        <Text style={styles.primaryStateText}>TELEMETRY LOST</Text>
        <Text style={styles.primaryLabel}>DETAILS AVAILABLE WHEN PARKED</Text>
      </View>
      <Text style={styles.drivingHint}>Eyes on the road</Text>
    </View>
  );
}

function ParkedAdvisoryBanner({ advisory }: { advisory?: DriverAdvisory }) {
  if (!advisory) return null;
  const warning = advisory.severity === 'WARNING' || advisory.severity === 'CRITICAL';
  return (
    <View style={[styles.advisoryBanner, warning ? styles.advisoryBannerWarning : styles.advisoryBannerNotice]}>
      <View style={styles.advisoryIndicator} />
      <Text numberOfLines={1} style={styles.advisoryLine}>
        <Text style={styles.advisoryTitle}>{advisory.title} · </Text>
        {advisory.shortMessage}
      </Text>
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
  const [clock, setClock] = useState(() => Date.now());
  const [motion, setMotion] = useState(() => initialMotionState(Date.now()));
  const [alertEpisode, setAlertEpisode] = useState<AlertEpisode>(INACTIVE_ALERT_EPISODE);
  const { observations, selectedMode } = useDriverMode();
  const liveVoiceMemory = useRef<LiveDriverAlertMemory>({});

  useEffect(() => {
    let mounted = true;
    void loadDriverPreferences().then(next => { if (mounted) setPreferences(next); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const speedObservation = observations.VEHICLE_SPEED;
  const gnssSpeedObservation = observations.GNSS_SPEED;

  useEffect(() => {
    const evidence: MotionEvidence[] = [];
    if (speedObservation) {
      evidence.push({
        source: 'ECU_SPEED',
        valueKmh: speedObservation.value,
        observedAt: speedObservation.observedAt,
        quality: speedObservation.quality,
        decisionable: isTrustedFor(speedObservation, 'DECISIONABLE', clock),
      });
    }
    if (gnssSpeedObservation) {
      evidence.push({
        source: 'PHONE_GNSS',
        valueKmh: gnssSpeedObservation.value,
        observedAt: gnssSpeedObservation.observedAt,
        quality: gnssSpeedObservation.quality,
        decisionable: isTrustedFor(gnssSpeedObservation, 'DECISIONABLE', clock),
      });
    }
    setMotion(previous => resolveMotionState(previous, evidence, clock));
  }, [
    clock,
    speedObservation?.value,
    speedObservation?.observedAt,
    speedObservation?.quality,
    gnssSpeedObservation?.value,
    gnssSpeedObservation?.observedAt,
    gnssSpeedObservation?.quality,
  ]);

  const presentation = useMemo(
    () => resolveDrivingModePresentation(selectedMode, observations, clock),
    [selectedMode, observations, clock],
  );

  const coolantObservation = observations.ENGINE_COOLANT;
  const coolantAlertable = isTrustedFor(coolantObservation, 'ALERTABLE', clock);
  const liveAlertCandidate = useMemo(() => {
    if (!coolantObservation?.advisory || !coolantAlertable) return null;
    return selectCoolantDriverAlert({
      quality: coolantObservation.quality === 'VALID'
        ? 'VALID'
        : coolantObservation.quality === 'STALE'
          ? 'STALE'
          : 'UNAVAILABLE',
      advisory: coolantObservation.advisory,
    }, Number.isFinite(coolantObservation.value));
  }, [coolantAlertable, coolantObservation?.advisory, coolantObservation?.quality, coolantObservation?.value]);

  useEffect(() => {
    setAlertEpisode(previous => advanceAlertLifecycle(previous, {
      detectedAlert: liveAlertCandidate,
      evidenceAvailable: coolantAlertable,
      nowMs: clock,
    }));
  }, [clock, coolantAlertable, liveAlertCandidate?.key, liveAlertCandidate?.severity]);

  const scanAdvisory = advisories.find(item =>
    (item.id.startsWith('health:') || item.id.startsWith('dtc:')) &&
    (item.severity === 'WARNING' || item.severity === 'CRITICAL'),
  );
  const scanAlert = scanAdvisory ? DRIVER_ALERT_LEXICON.CHECK_ENGINE : null;
  const lifecycleAlert = lifecyclePresentationAlert(alertEpisode);
  const unresolved = alertEpisode.state === 'UNRESOLVED';
  const effectiveAlert = lifecycleAlert ?? (!unresolved ? scanAlert : null);
  const voiceAlert = effectiveAlert ?? (unresolved ? DRIVER_ALERT_LEXICON.SIGNAL_LOST : null);

  useEffect(() => {
    if (!voiceAlert || terminalOutcome) return;
    const spokenAt = Date.now();
    if (!shouldSpeakLiveAlert(voiceAlert, preferences, liveVoiceMemory.current, spokenAt)) return;

    const phrase = driverAlertPhrase(voiceAlert.key, preferences.voiceLanguage);
    void speakDriverMessage(phrase, preferences.voiceLanguage).then(spoken => {
      if (!spoken) return;
      liveVoiceMemory.current = markLiveAlertSpoken(voiceAlert, spokenAt);
      if (voiceAlert.severity === 'S3_CRITICAL') Vibration.vibrate([0, 180, 90, 180]);
      else if (voiceAlert.severity === 'S2_ATTENTION') Vibration.vibrate(120);
    });
  }, [voiceAlert?.key, voiceAlert?.severity, preferences, terminalOutcome]);

  const lowDistraction = motion.state !== 'PARKED';
  const showCompactTerminal = Boolean(terminalOutcome && lowDistraction);

  return (
    <View style={styles.container}>
      {!terminalOutcome && motion.state === 'PARKED' ? <ParkedAdvisoryBanner advisory={advisories[0]} /> : null}
      {!terminalOutcome ? <DriverModePanel disabled={false} compact={lowDistraction} /> : null}

      {showCompactTerminal && terminalOutcome ? (
        <LowDistractionTerminalSurface outcome={terminalOutcome} />
      ) : lowDistraction ? (
        <DrivingPresentationSurface
          alert={effectiveAlert}
          alertEpisode={alertEpisode}
          motionState={motion.state}
          presentation={presentation}
          voiceEnabled={preferences.voiceAlertsEnabled}
        />
      ) : (
        <>
          {!terminalOutcome ? <DriverStartupCoordinator diagnosticScanComplete advisories={advisories} /> : null}
          {!terminalOutcome ? <DriverContextualIntelligence /> : null}
        </>
      )}

      <View style={lowDistraction ? styles.hiddenLiveContainer : styles.liveContainer} pointerEvents={lowDistraction ? 'none' : 'auto'}>
        <LiveSessionScreen
          supplement={!terminalOutcome ? <PhoneSensorBridge vehicleId={vehicleId} /> : null}
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

  return (
    <View style={styles.container}>
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
  drivingStateCopy: { flex: 1, alignItems: 'center' },
  drivingIcon: { fontSize: 30, marginRight: 12, fontWeight: '900' },
  drivingHeadline: { flexShrink: 1, fontSize: 26, lineHeight: 30, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  drivingStateMeta: { color: '#94a3b8', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 3 },
  primaryMetric: { alignItems: 'center', justifyContent: 'center', marginVertical: 20, minHeight: 104 },
  primaryInline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  primaryValue: { color: '#f8fafc', fontSize: 70, lineHeight: 74, fontWeight: '900', fontVariant: ['tabular-nums'] },
  primaryUnit: { color: '#94a3b8', fontSize: 18, fontWeight: '800', marginLeft: 5 },
  primaryStateText: { color: '#f8fafc', fontSize: 35, lineHeight: 40, fontWeight: '900', textAlign: 'center', letterSpacing: 0.4 },
  primaryLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginTop: 7 },
  drivingSecondaryRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#11191d', borderRadius: 15, borderWidth: 1, borderColor: '#263239' },
  secondaryMetric: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  secondaryValue: { color: '#e2e8f0', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  secondaryLabel: { color: '#64748b', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 2 },
  secondaryDivider: { width: 1, height: 34, backgroundColor: '#334155' },
  safetyOverrideFooter: { minHeight: 58, borderRadius: 15, borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: '#1f1215', alignItems: 'center', justifyContent: 'center' },
  safetyOverrideText: { color: '#fca5a5', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  drivingHint: { color: '#64748b', fontSize: 9, textAlign: 'center', marginTop: 10, letterSpacing: 0.3 },
});