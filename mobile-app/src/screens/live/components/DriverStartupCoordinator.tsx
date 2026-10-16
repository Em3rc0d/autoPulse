import React, { useEffect, useMemo, useState } from 'react';
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

interface Props {
  diagnosticScanComplete: boolean;
  advisories: readonly DriverAdvisory[];
}

export function DriverStartupCoordinator({ diagnosticScanComplete, advisories }: Props) {
  const { observations } = useDriverMode();
  const [briefed, setBriefed] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
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

  const assessment = useMemo(() => resolveStartupAssessment({
    connected: true,
    criticalChecksComplete: diagnosticScanComplete,
    diagnosticScanComplete,
    coldStartObservationComplete: maturity.complete,
    startedAt: Math.min(
      observations.ENGINE_RPM?.firstObservedAt ?? nowMs,
      observations.ENGINE_COOLANT?.firstObservedAt ?? nowMs,
    ),
    now: nowMs,
    advisories,
  }), [diagnosticScanComplete, maturity.complete, advisories, observations.ENGINE_RPM?.firstObservedAt, observations.ENGINE_COOLANT?.firstObservedAt, nowMs]);

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
        {maturity.kind === 'COLD' ? 'COLD START' : 'STARTUP'}
      </Text>
      <Text numberOfLines={1} style={styles.message}>
        {maturity.kind === 'COLD' ? 'Observing warm-up' : 'Collecting stable evidence'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 30,
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
  title: { color: '#94a3b8', fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginRight: 7 },
  message: { color: '#64748b', fontSize: 9, flex: 1 },
});
