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

  // This is a transient status, not an UNKNOWN vehicle metric. It tells the
  // driver why the final briefing has not happened yet without inventing health.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {maturity.kind === 'COLD' ? 'COLD-START OBSERVATION' : 'STARTUP OBSERVATION'}
      </Text>
      <Text style={styles.message}>
        {maturity.kind === 'COLD'
          ? 'AutoPulse is observing engine warm-up.'
          : 'AutoPulse is collecting stable engine evidence.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#11191d',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  message: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
});
