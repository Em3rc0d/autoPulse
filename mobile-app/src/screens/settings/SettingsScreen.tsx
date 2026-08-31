import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import {
  DEFAULT_DRIVER_PREFERENCES,
  loadDriverPreferences,
  saveDriverPreferences,
  type DriverPreferences,
} from '../../application/settings/DriverPreferences';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';

export default function SettingsScreen() {
  const [preferences, setPreferences] = useState<DriverPreferences>(DEFAULT_DRIVER_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDriverPreferences()
      .then(value => { if (mounted) setPreferences(value); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const persist = async (patch: Partial<DriverPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setSaving(true);
    try {
      setPreferences(await saveDriverPreferences(next));
    } finally {
      setSaving(false);
    }
  };

  const setLanguage = (voiceLanguage: VoiceLanguage) => void persist({ voiceLanguage });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d7ff4f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>DRIVER COMMUNICATION</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.lead}>While driving, AutoPulse communicates with short voice alerts and glanceable states. Detailed explanations stay on parked screens.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.label}>Voice alerts</Text>
            <Text style={styles.hint}>Short, controlled phrases only.</Text>
          </View>
          <Switch
            value={preferences.voiceAlertsEnabled}
            onValueChange={value => void persist({ voiceAlertsEnabled: value })}
            trackColor={{ false: '#334155', true: '#65a30d' }}
            thumbColor="#f8fafc"
          />
        </View>

        <Text style={styles.sectionLabel}>VOICE LANGUAGE</Text>
        <View style={styles.languageRow}>
          <LanguageButton label="English" active={preferences.voiceLanguage === 'en-US'} onPress={() => setLanguage('en-US')} />
          <LanguageButton label="Español" active={preferences.voiceLanguage === 'es-ES'} onPress={() => setLanguage('es-ES')} />
        </View>
        <Text style={styles.defaultNote}>English is the default language.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Alert levels</Text>
        <AlertToggle
          title="Critical"
          description="Immediate safety state. Kept enabled by default."
          value={preferences.criticalAlertsEnabled}
          onChange={value => void persist({ criticalAlertsEnabled: value })}
        />
        <AlertToggle
          title="Attention"
          description="Conditions that require driver awareness."
          value={preferences.attentionAlertsEnabled}
          onChange={value => void persist({ attentionAlertsEnabled: value })}
        />
        <AlertToggle
          title="Advisory"
          description="Low-priority voice. Off by default to avoid chatter."
          value={preferences.advisoryAlertsEnabled}
          onChange={value => void persist({ advisoryAlertsEnabled: value })}
        />
      </View>

      <View style={styles.contract}>
        <Text style={styles.contractTitle}>Driving UX contract</Text>
        <Text style={styles.contractText}>VOICE + COLOR + ICON → first. Text → evidence for later review.</Text>
      </View>

      {saving ? <Text style={styles.saving}>Saving…</Text> : null}
    </ScrollView>
  );
}

function LanguageButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.languageButton, active && styles.languageButtonActive]} onPress={onPress}>
      <Text style={[styles.languageText, active && styles.languageTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AlertToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.alertRow}>
      <View style={styles.rowCopy}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.hint}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#334155', true: '#65a30d' }} thumbColor="#f8fafc" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1114' },
  content: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1114' },
  eyebrow: { color: '#d7ff4f', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.8 },
  title: { color: '#f8fafc', fontSize: 28, fontFamily: 'Inter_700Bold', marginTop: 5 },
  lead: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 18 },
  card: { backgroundColor: '#141d21', borderColor: '#2a363d', borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 12 },
  cardTitle: { color: '#f8fafc', fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  alertRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopColor: '#263239', borderTopWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1 },
  label: { color: '#f1f5f9', fontSize: 13, fontFamily: 'Inter_700Bold' },
  hint: { color: '#64748b', fontSize: 10, lineHeight: 14, marginTop: 3 },
  sectionLabel: { color: '#64748b', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, marginTop: 12, marginBottom: 8 },
  languageRow: { flexDirection: 'row', gap: 8 },
  languageButton: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: '#334155', backgroundColor: '#11191d', alignItems: 'center', justifyContent: 'center' },
  languageButtonActive: { backgroundColor: '#d7ff4f', borderColor: '#d7ff4f' },
  languageText: { color: '#cbd5e1', fontSize: 12, fontFamily: 'Inter_700Bold' },
  languageTextActive: { color: '#0b1114' },
  defaultNote: { color: '#64748b', fontSize: 9, marginTop: 7 },
  contract: { padding: 14, borderRadius: 14, backgroundColor: '#10171b', borderWidth: 1, borderColor: '#263239' },
  contractTitle: { color: '#d7ff4f', fontSize: 11, fontFamily: 'Inter_700Bold' },
  contractText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16, marginTop: 5 },
  saving: { color: '#64748b', fontSize: 9, textAlign: 'center', marginTop: 10 },
});
