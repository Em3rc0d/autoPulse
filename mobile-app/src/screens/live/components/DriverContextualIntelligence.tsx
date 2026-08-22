import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';
import {
  createDriverVoiceMemory,
  decideAdvisoryVoice,
  evaluateContextualDriverAdvisories,
  markAdvisorySpoken,
  type DriverSignalEvidenceMap,
} from '../../../domain/driver-intelligence';
import { speakDriverMessage } from '../../../infrastructure/voice/AndroidDriverVoice';
import { useDriverMode } from './DriverModeContext';

export function DriverContextualIntelligence() {
  const { observations } = useDriverMode();
  const voiceMemory = useRef(createDriverVoiceMemory());

  const evidence = useMemo<DriverSignalEvidenceMap>(() => {
    const result: DriverSignalEvidenceMap = {};
    Object.values(observations).forEach(observation => {
      result[observation.signalId] = {
        signalId: observation.signalId,
        value: observation.value,
        unit: observation.unit,
        quality: observation.quality,
        origin: observation.origin,
      };
    });
    return result;
  }, [observations]);

  const advisories = useMemo(
    () => evaluateContextualDriverAdvisories(evidence, Date.now()),
    [evidence],
  );
  const active = advisories[0];

  useEffect(() => {
    if (!active) return;
    const decision = decideAdvisoryVoice(active, voiceMemory.current, Date.now());
    if (!decision.shouldSpeak || !decision.message) return;

    if (active.severity === 'CRITICAL') {
      Vibration.vibrate([0, 250, 150, 250]);
    } else if (active.severity === 'WARNING') {
      Vibration.vibrate(180);
    }

    speakDriverMessage(decision.message).then(spoken => {
      if (spoken) {
        voiceMemory.current = markAdvisorySpoken(voiceMemory.current, active.id, Date.now());
      }
    });
  }, [active?.id, active?.severity, active?.shortMessage]);

  if (!active) return null;

  return (
    <View style={[
      styles.container,
      active.severity === 'CRITICAL'
        ? styles.critical
        : active.severity === 'WARNING'
          ? styles.warning
          : styles.notice,
    ]}>
      <Text style={styles.title}>{active.title}</Text>
      <Text style={styles.message}>{active.shortMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  critical: {
    backgroundColor: 'rgba(220, 38, 38, 0.18)',
    borderColor: '#ef4444',
  },
  warning: {
    backgroundColor: 'rgba(234, 88, 12, 0.16)',
    borderColor: '#f97316',
  },
  notice: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: '#f59e0b',
  },
  title: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  message: {
    marginTop: 3,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
});
