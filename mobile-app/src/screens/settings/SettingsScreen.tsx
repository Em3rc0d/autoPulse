import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { DriverVoiceLanguage } from '../../domain/driver-intelligence';
import {
  DRIVER_VOICE_LANGUAGE_OPTIONS,
  loadDriverVoiceLanguage,
  saveDriverVoiceLanguage,
} from '../../infrastructure/voice/DriverVoicePreferences';
import { speakDriverAlert } from '../../infrastructure/voice/AndroidDriverVoice';

export default function SettingsScreen() {
  const [voiceLanguage, setVoiceLanguage] = useState<DriverVoiceLanguage>('en-US');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadDriverVoiceLanguage().then(language => {
      if (!mounted) return;
      setVoiceLanguage(language);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const selectLanguage = async (language: DriverVoiceLanguage) => {
    setVoiceLanguage(language);
    await saveDriverVoiceLanguage(language);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AUTOPULSE</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Driving alerts stay short. Detailed evidence remains on screen for parked review.</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VOICE ALERTS</Text>
          <Text style={styles.sectionDescription}>English is the default. Select the language used by spoken driving cues.</Text>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#d7ff4f" />
          ) : (
            <View style={styles.languageGroup}>
              {DRIVER_VOICE_LANGUAGE_OPTIONS.map(option => {
                const selected = voiceLanguage === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    testID={`voice-language-${option.value}`}
                    style={[styles.languageOption, selected && styles.languageOptionSelected]}
                    onPress={() => void selectLanguage(option.value)}
                    activeOpacity={0.82}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.languageCopy}>
                      <Text style={[styles.languageLabel, selected && styles.languageLabelSelected]}>{option.label}</Text>
                      <Text style={styles.languageDetail}>{option.detail}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => void speakDriverAlert('CHECK_ENGINE')}
            activeOpacity={0.82}
          >
            <Text style={styles.previewButtonText}>Preview voice</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteMark}>!</Text>
          <Text style={styles.noteText}>While moving, AutoPulse prioritizes voice, color and concise status cues over detailed text.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: '#11191d', borderBottomWidth: 1, borderBottomColor: '#263239' },
  eyebrow: { color: '#d7ff4f', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.8 },
  title: { color: '#f8fafc', fontSize: 27, fontFamily: 'Inter_700Bold', marginTop: 5 },
  subtitle: { color: '#94a3b8', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 7 },
  content: { padding: 16 },
  section: { backgroundColor: '#11191d', borderWidth: 1, borderColor: '#263239', borderRadius: 16, padding: 16 },
  sectionTitle: { color: '#f8fafc', fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.1 },
  sectionDescription: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 6, fontFamily: 'Inter_400Regular' },
  loader: { marginVertical: 24 },
  languageGroup: { marginTop: 14, gap: 8 },
  languageOption: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#2a3439', backgroundColor: '#172026', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  languageOptionSelected: { borderColor: '#d7ff4f', backgroundColor: '#1b251e' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  radioSelected: { borderColor: '#d7ff4f' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d7ff4f' },
  languageCopy: { flex: 1 },
  languageLabel: { color: '#e2e8f0', fontSize: 14, fontFamily: 'Inter_700Bold' },
  languageLabelSelected: { color: '#f8fafc' },
  languageDetail: { color: '#64748b', fontSize: 10, marginTop: 2, fontFamily: 'Inter_500Medium' },
  previewButton: { marginTop: 14, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  previewButtonText: { color: '#e2e8f0', fontSize: 12, fontFamily: 'Inter_700Bold' },
  noteCard: { marginTop: 12, borderRadius: 14, backgroundColor: '#10171b', borderWidth: 1, borderColor: '#263239', padding: 13, flexDirection: 'row', alignItems: 'center' },
  noteMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#78350f', color: '#fbbf24', textAlign: 'center', lineHeight: 26, fontFamily: 'Inter_700Bold', marginRight: 10, overflow: 'hidden' },
  noteText: { flex: 1, color: '#94a3b8', fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium' },
});
