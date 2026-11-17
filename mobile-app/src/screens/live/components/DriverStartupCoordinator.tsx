import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  resolveColdStartMaturity,
  resolveStartupAssessment,
  type DriverAdvisory,
} from '../../../domain/driver-intelligence';
import { driverAlertPhrase } from '../../../domain/driver-intelligence/DriverAlertLexicon';
import {
  DEFAULT_DRIVER_PREFERENCES,
  loadDriverPreferences,
  type DriverPreferences,
} from '../../../application/settings/DriverPreferences';
import { speakDriverMessage } from '../../../infrastructure/voice/AndroidDriverVoice';
import { useDriverMode } from './DriverModeContext';
import { resolveStartupEvidenceGate, type LiveCharacterizationStatus } from '../../../domain/driver-intelligence/LiveStartupReadiness';

interface Props {
  characterizationStatus: LiveCharacterizationStatus;
  advisories: readonly DriverAdvisory[];
}

export function DriverStartupCoordinator({ characterizationStatus, advisories }: Props) {
  const { observations } = useDriverMode();
  const [briefed, setBriefed] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const mountedAt = useRef(Date.now());
  const [preferences, setPreferences] = useState<DriverPreferences>(DEFAULT_DRIVER_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadDriverPreferences()
      .then(next => { if (mounted) setPreferences(next); })
      .finally(() => { if (mounted) setPreferencesLoaded(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (briefed) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [briefed]);

  const maturity = useMemo(() => resolveColdStartMaturity({
    rpm: observations.ENGINE_RPM,
    coolant: observations.ENGINE_COOLANT,
    nowMs,
  }), [observations.ENGINE_RPM, observations.ENGINE_COOLANT, nowMs]);

  // Reachability is a verified read-only preflight, not a complete vehicle Check.
  // Fresh ECU evidence is required separately from any adapter handshake.
  const startupGate = useMemo(() => resolveStartupEvidenceGate({
    rpm: observations.ENGINE_RPM,
    coolant: observations.ENGINE_COOLANT,
    nowMs,
    characterizationStatus,
  }), [observations.ENGINE_RPM, observations.ENGINE_COOLANT, nowMs, characterizationStatus]);

  const assessment = useMemo(() => resolveStartupAssessment({
    connected: startupGate.ecuEvidenceCurrent,
    criticalChecksComplete: startupGate.readOnlyCharacterizationVerified,
    diagnosticScanComplete: startupGate.readOnlyCharacterizationVerified,
    coldStartObservationComplete: maturity.complete,
    startedAt: Math.min(
      observations.ENGINE_RPM?.firstObservedAt ?? nowMs,
      observations.ENGINE_COOLANT?.firstObservedAt ?? nowMs,
    ),
    now: nowMs,
    advisories,
  }), [startupGate.ecuEvidenceCurrent, startupGate.readOnlyCharacterizationVerified, maturity.complete,
    advisories, observations.ENGINE_RPM?.firstObservedAt, observations.ENGINE_COOLANT?.firstObservedAt, nowMs]);

  const limitedSignals = maturity.reason === 'CORE_SIGNALS_MISSING' &&
    nowMs - mountedAt.current >= 15_000;
  const limitedCheck = characterizationStatus === 'FAILED' ||
    characterizationStatus === 'LIMITED' || characterizationStatus === 'NOT_RUN';
  const spanish = preferences.voiceLanguage === 'es-ES';
  const title = limitedCheck
    ? (spanish ? 'CHEQUEO LIMITADO' : 'CHECK LIMITED')
    : limitedSignals
      ? (spanish ? 'DATOS LIMITADOS' : 'DATA LIMITED')
      : maturity.kind === 'COLD' ? 'COLD START' : 'STARTUP';
  const message = limitedCheck
    ? (spanish ? 'Comprobación OBD no confirmada' : 'OBD preflight not verified')
    : limitedSignals
      ? (spanish ? 'RPM y refrigerante sin evidencia suficiente' : 'RPM / coolant evidence incomplete')
      : maturity.kind === 'COLD'
        ? (spanish ? 'Observando calentamiento' : 'Observing warm-up')
        : (spanish ? 'Reuniendo evidencia actual' : 'Collecting current evidence');

  useEffect(() => {
    if (briefed || !preferencesLoaded || !assessment.canBrief || assessment.scanInProgress) return;
    if (!preferences.voiceAlertsEnabled) {
      setBriefed(true);
      return;
    }

    const message = driverAlertPhrase('AUTOPULSE_READY', preferences.voiceLanguage);
    void speakDriverMessage(message, preferences.voiceLanguage).then(spoken => {
      if (spoken) setBriefed(true);
    });
  }, [briefed, assessment.canBrief, assessment.scanInProgress, preferences, preferencesLoaded]);

  if (briefed || assessment.phase === 'READY') return null;

  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <Text numberOfLines={1} style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 38,
    marginHorizontal: 12,
    marginTop: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#11191d',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#60a5fa', marginRight: 6 },
  title: { color: '#cbd5e1', fontSize: 11, fontWeight: '800', letterSpacing: 0.3, marginRight: 7 },
  message: { color: '#cbd5e1', fontSize: 12, flex: 1 },
});
