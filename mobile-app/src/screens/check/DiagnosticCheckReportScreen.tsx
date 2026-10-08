import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useProductDb } from '../../infrastructure/hooks/useProductDb';
import { useLocalContext } from '../../infrastructure/hooks/useLocalContext';
import { DiagnosticCheckReportRepository } from '../../infrastructure/database/product/repositories/diagnostic-check-report.repository';
import {
  DiagnosticCheckReportService,
  type DiagnosticCheckReportResult,
} from '../../application/check/DiagnosticCheckReportService';
import { formatDecodedPidObservation } from '../../application/check/intelligence/Mode01ValueDecoder';
import { CHECK_V4_PID_WALLET } from '../../application/check/intelligence/PidWallet';
import { uiText, useUiLanguage } from '../../application/localization/UiLanguage';

function dtcCodes(result: DiagnosticCheckReportResult): string[] {
  return result.snapshot.dtcResults
    .flatMap(item => item.codes.map(code => `${code.code} · ${item.status}`));
}

export default function DiagnosticCheckReportScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const language = useUiLanguage();
  const t = (en: string, es: string) => uiText(language, en, es);
  const checkId = route.params?.checkId as string | undefined;
  const db = useProductDb();
  const { context, loading: contextLoading } = useLocalContext();
  const workspaceId = context?.defaultWorkspaceId as string | undefined;
  const [report, setReport] = useState<DiagnosticCheckReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !workspaceId || !checkId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const service = new DiagnosticCheckReportService(new DiagnosticCheckReportRepository(db));
        const loaded = await service.load(workspaceId, checkId);
        if (!cancelled) {
          if (!loaded) setError('DIAGNOSTIC_CHECK_NOT_FOUND');
          else setReport(loaded);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'DIAGNOSTIC_CHECK_LOAD_FAILED');
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [checkId, db, workspaceId]);

  if (!checkId) {
    return <View style={styles.center}><Text style={styles.error}>{t('Check identifier missing.','Falta el identificador del Check.')}</Text></View>;
  }

  if (contextLoading || !db || !workspaceId || (!report && !error)) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#4ade80" /><Text style={styles.muted}>{t('Verifying sealed evidence…','Verificando evidencia sellada…')}</Text></View>;
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{t('Sealed Check unavailable','Check sellado no disponible')}</Text>
        <Text style={styles.muted}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>{t('Back','Volver')}</Text></TouchableOpacity>
      </View>
    );
  }

  const { snapshot } = report;
  const vehicleLabel = snapshot.vehicle.alias
    ?? ([snapshot.vehicle.make, snapshot.vehicle.model, snapshot.vehicle.year].filter(Boolean).join(' ') || snapshot.vehicle.vehicleId);
  const codes = dtcCodes(report);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Check</Text></TouchableOpacity>
        <Text style={styles.eyebrow}>{t('IMMUTABLE ECU EVIDENCE','EVIDENCIA ECU INMUTABLE')}</Text>
        <Text style={styles.title}>{t('Sealed Check Report','Reporte Check Sellado')}</Text>
        <Text style={styles.sub}>{vehicleLabel}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.verified}>
          <Text style={styles.verifiedTitle}>{report.verified ? t('INTEGRITY VERIFIED','INTEGRIDAD VERIFICADA') : t('INTEGRITY NOT VERIFIED','INTEGRIDAD NO VERIFICADA')}</Text>
          <Text style={styles.body}>{t('This report preserves what AutoPulse observed during the read-only Check. It is not a mechanical PASS/FAIL verdict.','Este reporte conserva lo que AutoPulse observó durante el Check de solo lectura. No es un veredicto mecánico PASS/FAIL.')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Execution','Ejecución')}</Text>
          <Row label={t('Protocol','Protocolo')} value={snapshot.protocol} />
          <Row label={t('Check engine','Motor de Check')} value={snapshot.pilotVersion} />
          <Row label={t('Core commands','Comandos core')} value={String(snapshot.execution.coreCommandsIssued)} />
          <Row label={t('Adaptive selected','Adaptativos seleccionados')} value={String(snapshot.execution.targetedCommandsSelected)} />
          <Row label={t('Adaptive executed','Adaptativos ejecutados')} value={String(snapshot.execution.targetedCommandsIssued)} />
          <Row label={t('Observed PID values','Valores PID observados')} value={String(snapshot.pidEvidence.length)} />
          <Row label={t('Promoted PID readers','Lectores PID promovidos')} value={String(CHECK_V4_PID_WALLET.filter(item => item.executableInCheckV4).length)} />
          <Row label={t('Scan state','Estado scan')} value={snapshot.execution.scanState} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('DTC evidence','Evidencia DTC')}</Text>
          {codes.length > 0
            ? codes.map(item => <Text key={item} style={styles.code}>{item}</Text>)
            : <Text style={styles.muted}>{t('No codes were reported by the successfully scanned standard DTC services.','Los servicios DTC estándar escaneados correctamente no reportaron códigos.')}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Readiness','Readiness')}</Text>
          {snapshot.readiness ? (
            <>
              <Row label="MIL" value={snapshot.readiness.milOn ? 'ON' : 'OFF'} />
              <Row label={t('Confirmed DTC count','Cantidad DTC confirmados')} value={String(snapshot.readiness.confirmedDtcCount)} />
              {snapshot.readiness.monitors.map(item => <Row key={item.id} label={item.label} value={item.state} />)}
            </>
          ) : <Text style={styles.muted}>{t('Readiness was not established from validated PID 0101 evidence.','Readiness no fue establecido mediante evidencia validada del PID 0101.')}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Adaptive ECU snapshot','Snapshot ECU adaptativo')}</Text>
          <Text style={styles.body}>{t('This sealed snapshot preserves only values actually observed during the bounded read-only scan. Missing signals are not treated as zero or healthy.','Este snapshot sellado conserva solo valores realmente observados durante el scan acotado de solo lectura. Señales ausentes no se tratan como cero ni saludables.')}</Text>
          <Text style={styles.meta}>{CHECK_V4_PID_WALLET.length} reference PIDs · {CHECK_V4_PID_WALLET.filter(item => item.executableInCheckV4).length} promoted readers</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Current ECU evidence','Evidencia actual ECU')}</Text>
          {snapshot.pidEvidence.length > 0
            ? snapshot.pidEvidence.map(item => <Text key={`${item.requestId}-${item.sourceEndpointId ?? 'u'}`} style={styles.evidence}>{formatDecodedPidObservation(item)}</Text>)
            : <Text style={styles.muted}>{t('No promoted current-data value was established.','No se estableció un valor actual promovido.')}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Diagnostic concerns','Hallazgos diagnósticos')}</Text>
          {snapshot.concerns.length > 0 ? snapshot.concerns.map(item => (
            <View key={item.concernId} style={styles.concern}>
              <Text style={styles.concernTitle}>{item.code} · {item.title}</Text>
              <Text style={styles.body}>{item.statuses.join(' + ')}</Text>
              <Text style={styles.warning}>{t('Exact mechanical cause not established.','Causa mecánica exacta no establecida.')}</Text>
            </View>
          )) : <Text style={styles.muted}>{t('No ECU concern was established from the scanned DTC services.','No se estableció un hallazgo ECU a partir de los servicios DTC escaneados.')}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Limitations','Limitaciones')}</Text>
          {snapshot.limitations.map((item, index) => <Text key={`${index}-${item}`} style={styles.limitation}>• {item}</Text>)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Integrity seal','Sello de integridad')}</Text>
          <Text style={styles.hashLabel}>SHA-256</Text>
          <Text selectable style={styles.hash}>{report.sha256}</Text>
          <Text style={styles.meta}>Check ID {snapshot.checkId}</Text>
          <Text style={styles.meta}>{new Date(snapshot.generatedAt).toISOString()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f12' },
  center: { flex: 1, backgroundColor: '#0a0f12', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  header: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 15, backgroundColor: '#10171b', borderBottomWidth: 1, borderBottomColor: '#263139' },
  back: { color: '#60a5fa', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  eyebrow: { color: '#4ade80', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: '900', marginTop: 4 },
  sub: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  content: { padding: 14, paddingBottom: 48 },
  verified: { backgroundColor: '#0c2317', borderColor: '#166534', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  verifiedTitle: { color: '#86efac', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  card: { backgroundColor: '#121b20', borderColor: '#2a363d', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#263139', paddingVertical: 7 },
  label: { color: '#94a3b8', fontSize: 11, flex: 1 },
  value: { color: '#e2e8f0', fontSize: 11, fontWeight: '800', textAlign: 'right', flex: 1 },
  body: { color: '#cbd5e1', fontSize: 11, lineHeight: 17, marginTop: 5 },
  muted: { color: '#94a3b8', fontSize: 11, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  code: { color: '#fbbf24', fontSize: 13, fontWeight: '900', paddingVertical: 5 },
  evidence: { color: '#cbd5e1', fontSize: 11, lineHeight: 17, paddingVertical: 5 },
  concern: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#334155', paddingVertical: 9 },
  concernTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '900' },
  warning: { color: '#fbbf24', fontSize: 10, marginTop: 5 },
  limitation: { color: '#cbd5e1', fontSize: 11, lineHeight: 17, marginBottom: 6 },
  hashLabel: { color: '#64748b', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  hash: { color: '#93c5fd', fontSize: 9, lineHeight: 15, marginTop: 5, fontFamily: 'monospace' },
  meta: { color: '#64748b', fontSize: 9, marginTop: 5 },
  error: { color: '#fca5a5', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  button: { borderWidth: 1, borderColor: '#475569', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginTop: 18 },
  buttonText: { color: '#f8fafc', fontWeight: '800' },
});
