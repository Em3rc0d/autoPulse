import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import {
  DEFAULT_DRIVER_PREFERENCES,
  loadDriverPreferences,
  saveDriverPreferences,
  type DriverPreferences,
} from '../../application/settings/DriverPreferences';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';
import { setUiLanguage, uiText } from '../../application/localization/UiLanguage';

export default function SettingsScreen() {
  const [preferences, setPreferences] = useState<DriverPreferences>(DEFAULT_DRIVER_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveInFlight = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadDriverPreferences()
      .then(value => { if (mounted) { setPreferences(value); setUiLanguage(value.voiceLanguage); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const persist = async (patch: Partial<DriverPreferences>) => {
    // Avoid overlapping async storage writes that could race and leave the UI
    // showing a different language from the one used by native safety speech.
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    const before = preferences;
    const next = { ...before, ...patch };
    setPreferences(next);
    setSaving(true);
    setSaveError(false);
    try {
      const durable = await saveDriverPreferences(next);
      setPreferences(durable);
      // Only publish a language switch after durable preference persistence.
      setUiLanguage(durable.voiceLanguage);
    } catch (error) {
      setPreferences(before);
      setUiLanguage(before.voiceLanguage);
      setSaveError(true);
      console.warn('[DriverPreferences] Could not save settings:', error);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const setLanguage = (voiceLanguage: VoiceLanguage) => {
    void persist({ voiceLanguage });
  };
  const t = (en: string, es: string) => uiText(preferences.voiceLanguage, en, es);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d7ff4f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{t('DRIVER COMMUNICATION','COMUNICACIÓN CON EL CONDUCTOR')}</Text>
      <Text style={styles.title}>{t('Settings','Configuración')}</Text>
      <Text style={styles.lead}>{t('While driving, AutoPulse communicates with short voice alerts and glanceable states. Detailed explanations stay on parked screens.','Mientras conduces, AutoPulse usa alertas de voz breves y estados fáciles de ver. Las explicaciones detalladas quedan para cuando estés estacionado.')}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.label}>{t('Voice alerts','Alertas de voz')}</Text>
            <Text style={styles.hint}>{t('Short, controlled phrases only.','Solo frases breves y controladas.')}</Text>
          </View>
          <Switch
            disabled={saving}
            value={preferences.voiceAlertsEnabled}
            onValueChange={value => void persist({ voiceAlertsEnabled: value })}
            trackColor={{ false: '#334155', true: '#65a30d' }}
            thumbColor="#f8fafc"
          />
        </View>

        <Text style={styles.sectionLabel}>{t('VOICE LANGUAGE','IDIOMA DE LA APP Y VOZ')}</Text>
        <View style={styles.languageRow}>
          <LanguageButton label="English" active={preferences.voiceLanguage === 'en-US'} disabled={saving} onPress={() => setLanguage('en-US')} />
          <LanguageButton label="Español" active={preferences.voiceLanguage === 'es-ES'} disabled={saving} onPress={() => setLanguage('es-ES')} />
        </View>
        <Text style={styles.defaultNote}>{t('English is the default language.','El inglés es el idioma predeterminado.')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('Alert levels','Niveles de alerta')}</Text>
        <AlertToggle
          title={t('Critical','Crítico')}
          description={t('Immediate safety state. Kept enabled by default.','Estado de seguridad inmediato. Activado por defecto.')}
          value={preferences.criticalAlertsEnabled}
          disabled={saving}
          onChange={value => void persist({ criticalAlertsEnabled: value })}
        />
        <AlertToggle
          title={t('Attention','Atención')}
          description={t('Conditions that require driver awareness.','Condiciones que requieren atención del conductor.')}
          value={preferences.attentionAlertsEnabled}
          disabled={saving}
          onChange={value => void persist({ attentionAlertsEnabled: value })}
        />
        <AlertToggle
          title={t('Advisory','Aviso')}
          description={t('Low-priority voice. Off by default to avoid chatter.','Voz de baja prioridad. Desactivada por defecto para evitar ruido.')}
          value={preferences.advisoryAlertsEnabled}
          disabled={saving}
          onChange={value => void persist({ advisoryAlertsEnabled: value })}
        />
      </View>

      <View style={styles.contract}>
        <Text style={styles.contractTitle}>{t('Driving UX contract','Contrato UX de conducción')}</Text>
        <Text style={styles.contractText}>{t('VOICE + COLOR + ICON → first. Text → evidence for later review.','VOZ + COLOR + ICONO → primero. Texto → evidencia para revisión posterior.')}</Text>
      </View>

      {saving ? <Text style={styles.saving}>{t('Saving…','Guardando…')}</Text> : null}
      {saveError ? <Text accessibilityRole="alert" testID="settings-save-error" style={styles.saveError}>{t('Could not save settings. Try again.', 'No se pudieron guardar los ajustes. Inténtalo nuevamente.')}</Text> : null}
    </ScrollView>
  );
}

function LanguageButton({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity disabled={disabled} style={[styles.languageButton, active && styles.languageButtonActive]} onPress={onPress}>
      <Text style={[styles.languageText, active && styles.languageTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AlertToggle({ title, description, value, disabled, onChange }: { title: string; description: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.alertRow}>
      <View style={styles.rowCopy}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.hint}>{description}</Text>
      </View>
      <Switch disabled={disabled} value={value} onValueChange={onChange} trackColor={{ false: '#334155', true: '#65a30d' }} thumbColor="#f8fafc" />
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
  saveError: { color: '#fca5a5', fontSize: 12, marginTop: 10, textAlign: 'center' },
});
