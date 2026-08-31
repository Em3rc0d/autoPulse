import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  buildStartupBriefing,
  createDriverVoiceMemory,
  decideStartupVoiceWhenReady,
  markStartupSpoken,
  resolveColdStartMaturity,
  resolveStartupAssessment,
  type DriverAdvisory,
} from '../../../domain/driver-intelligence';
import { speakDriverMessage } from '../../../infrastructure/voice/AndroidDriverVoice';
import { useDriverMode } from './DriverModeContext';

interface Props {
  diagnosticScanComplete: boolean;
  advisories: readonly DriverAdvisory[];
}

export function DriverStartupCoordinator({ diagnosticScanComplete, advisories }: Props) {
  const { observations } = useDriverMode();
  const voiceMemory = useRef(createDriverVoiceMemory());
  const [briefed, setBriefed] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

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
    if (briefed || !assessment.canBrief || assessment.scanInProgress) return;
    const briefing = buildStartupBriefing(advisories);
    const decision = decideStartupVoiceWhenReady(briefing, voiceMemory.current, assessment);
    if (!decision.shouldSpeak || !decision.message) return;

    speakDriverMessage(decision.message).then(spoken => {
      if (!spoken) return;
      voiceMemory.current = markStartupSpoken(voiceMemory.current);
      setBriefed(true);
    });
  }, [briefed, assessment, advisories]);

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
