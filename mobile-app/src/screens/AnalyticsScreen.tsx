import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Dimensions, Animated, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useIsFocused } from '@react-navigation/native';
import { useOBDPolling } from '../hooks/useOBDPolling';
import { localStore } from '../services/localStore';
import { bluetoothOBD } from '../services/bluetoothOBD';
import { COLORS, FONTS, globalStyles } from '../styles/theme';

const VEHICLE_ID = 'mi-vehiculo-default';
const screenWidth = Dimensions.get("window").width;

export default function AnalyticsScreen() {
  const { data, polling } = useOBDPolling(VEHICLE_ID, false);
  const [history, setHistory] = useState<number[]>(Array(10).fill(0));
  const [insights, setInsights] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [diagResults, setDiagResults] = useState<{ dtcs: string[], battery: string } | null>(null);
  const [extendedData, setExtendedData] = useState<any>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('speed');
  const [minMax, setMinMax] = useState<Record<string, { min: number, max: number }>>({});
  const isFocused = useIsFocused();

  useEffect(() => {
    let interval: any;
    if (isFocused && bluetoothOBD.isConnected()) {
      interval = setInterval(async () => {
        try {
          const ext = await bluetoothOBD.readExtendedData();
          setExtendedData(ext);
        } catch { }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isFocused]);

  useEffect(() => {
    let val = 0;
    if (selectedMetric === 'speed') val = data?.speed || 0;
    if (selectedMetric === 'rpm') val = data?.rpm || 0;
    if (selectedMetric === 'coolant') val = data?.coolant_temp || 0;
    if (selectedMetric === 'map') val = extendedData?.map || 0;
    if (selectedMetric === 'timing') val = extendedData?.timing_adv || 0;
    if (selectedMetric === 'intake') val = extendedData?.intake_temp || 0;

    setHistory(prev => [...prev.slice(1), val]);

    setMinMax(prev => {
      const next = { ...prev };
      const checkUpdate = (key: string, v: number | null | undefined) => {
        if (v === null || v === undefined) return;
        if (!next[key]) next[key] = { min: v, max: v };
        else {
          next[key].min = Math.min(next[key].min, v);
          next[key].max = Math.max(next[key].max, v);
        }
      };

      checkUpdate('speed', data?.speed);
      checkUpdate('rpm', data?.rpm);
      checkUpdate('coolant', data?.coolant_temp);
      checkUpdate('map', extendedData?.map);
      checkUpdate('timing', extendedData?.timing_adv);
      checkUpdate('intake', extendedData?.intake_temp);
      checkUpdate('o2', extendedData?.o2_voltage);
      checkUpdate('barometric', extendedData?.barometric);

      return next;
    });

  }, [data, extendedData, selectedMetric]);

  useEffect(() => {
    localStore.getInsights(VEHICLE_ID).then(setInsights).catch(() => {});
  }, [polling]);

  const runDiagnostic = async () => {
    if (!bluetoothOBD.isConnected()) {
      Alert.alert("Error", "Debes estar conectado al ELM327 para realizar un diagnóstico.");
      return;
    }
    setLoadingDiag(true);
    try {
      const res = await bluetoothOBD.fullDiagnostic();
      setDiagResults(res);
      if (res.dtcs.length === 0) {
        Alert.alert("DIAGNOSTIC COMPLETE", "No se encontraron códigos de error. El motor está operando nominalmente.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoadingDiag(false);
    }
  };

  const clearCodes = async () => {
    if (!bluetoothOBD.isConnected()) {
      Alert.alert("Error", "Debes estar conectado al ELM327 para borrar códigos.");
      return;
    }
    Alert.alert(
      "Confirmación",
      "¿Estás seguro de borrar los códigos de falla (Check Engine)?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            setLoadingDiag(true);
            try {
              const success = await bluetoothOBD.clearDTCs();
              if (success) {
                Alert.alert("Éxito", "Los códigos de error han sido borrados de la ECU.");
                setDiagResults(null);
              } else {
                Alert.alert("Error", "No se pudo borrar los códigos. Verifica la conexión.");
              }
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setLoadingDiag(false);
            }
          }
        }
      ]
    );
  };

  const chartConfig = {
    backgroundColor: COLORS.surface,
    backgroundGradientFrom: COLORS.surface,
    backgroundGradientTo: COLORS.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 209, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(221, 227, 231, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "0" }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={{ fontSize: 24, color: COLORS.onSurface }}>☰</Text>
          <Text style={styles.headerTitle}>AUTOPULSE</Text>
          <Text style={{ fontSize: 24, color: COLORS.onSurface }}>👤</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.mainTitle}>Pro Analytics</Text>
        <Text style={styles.subtitle}>Telemetría y Datos en Vivo</Text>

        {/* SELECTABLE CHART */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TENDENCIA: {selectedMetric.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.liveTag}> EN VIVO</Text>
            </View>
          </View>
          <LineChart
            data={{ labels: [], datasets: [{ data: history }] }}
            width={screenWidth - 80}
            height={100}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>

        {/* LIVE DATA GRID */}
        <Text style={styles.sectionHeader}>SENSORES EN VIVO (TOCA PARA GRAFICAR)</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'speed' && styles.gridItemActive]} onPress={() => { setSelectedMetric('speed'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>VELOCIDAD</Text>
            <Text style={styles.gridValue}>{data?.speed ?? '--'} <Text style={styles.gridUnit}>km/h</Text></Text>
            {minMax.speed && <Text style={styles.minMaxText}>Min: {minMax.speed.min} | Max: {minMax.speed.max}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'rpm' && styles.gridItemActive]} onPress={() => { setSelectedMetric('rpm'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>RPM</Text>
            <Text style={styles.gridValue}>{data?.rpm ?? '--'} <Text style={styles.gridUnit}>rev</Text></Text>
            {minMax.rpm && <Text style={styles.minMaxText}>Min: {minMax.rpm.min} | Max: {minMax.rpm.max}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'coolant' && styles.gridItemActive]} onPress={() => { setSelectedMetric('coolant'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>REFRIGERANTE</Text>
            <Text style={styles.gridValue}>{data?.coolant_temp ?? '--'} <Text style={styles.gridUnit}>°C</Text></Text>
            {minMax.coolant && <Text style={styles.minMaxText}>Min: {minMax.coolant.min} | Max: {minMax.coolant.max}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'map' && styles.gridItemActive]} onPress={() => { setSelectedMetric('map'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>MAP</Text>
            <Text style={styles.gridValue}>{extendedData?.map ?? '--'} <Text style={styles.gridUnit}>kPa</Text></Text>
            {minMax.map && <Text style={styles.minMaxText}>Min: {minMax.map.min} | Max: {minMax.map.max}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'timing' && styles.gridItemActive]} onPress={() => { setSelectedMetric('timing'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>AVANCE ENCEND.</Text>
            <Text style={styles.gridValue}>{extendedData?.timing_adv ?? '--'} <Text style={styles.gridUnit}>°</Text></Text>
            {minMax.timing && <Text style={styles.minMaxText}>Min: {minMax.timing.min} | Max: {minMax.timing.max}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'intake' && styles.gridItemActive]} onPress={() => { setSelectedMetric('intake'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>TEMP ADMISIÓN</Text>
            <Text style={styles.gridValue}>{extendedData?.intake_temp ?? '--'} <Text style={styles.gridUnit}>°C</Text></Text>
            {minMax.intake && <Text style={styles.minMaxText}>Min: {minMax.intake.min} | Max: {minMax.intake.max}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem, selectedMetric === 'o2' && styles.gridItemActive]} onPress={() => { setSelectedMetric('o2'); setHistory(Array(10).fill(0)); }}>
            <Text style={styles.gridLabel}>VOLTAJE O2</Text>
            <Text style={styles.gridValue}>{extendedData?.o2_voltage?.toFixed(2) ?? '--'} <Text style={styles.gridUnit}>V</Text></Text>
            {minMax.o2 && <Text style={styles.minMaxText}>Min: {minMax.o2.min.toFixed(2)} | Max: {minMax.o2.max.toFixed(2)}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridItem]}>
            <Text style={styles.gridLabel}>BAROMÉTRICA</Text>
            <Text style={styles.gridValue}>{extendedData?.barometric ?? '--'} <Text style={styles.gridUnit}>kPa</Text></Text>
            {minMax.barometric && <Text style={styles.minMaxText}>Min: {minMax.barometric.min} | Max: {minMax.barometric.max}</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>DIAGNÓSTICO CON IA</Text>
        <View style={[styles.diagnosisBox, diagResults?.dtcs?.length ? { borderLeftColor: COLORS.error } : {}]}>
          <View style={[styles.engineTag, diagResults?.dtcs?.length ? { borderColor: `${COLORS.error}33` } : {}]}>
            <Text style={[styles.engineTagText, diagResults?.dtcs?.length ? { color: COLORS.error } : {}]}>
              {diagResults?.dtcs?.length ? 'FALLA DETECTADA' : 'SISTEMA NOMINAL'}
            </Text>
          </View>
          <View style={styles.diagnosisDetails}>
            <View style={styles.detailItem}>
              <View style={styles.detailIcon}><Text>🔋</Text></View>
              <View>
                <Text style={styles.detailTitle}>Batería / Alternador</Text>
                <Text style={styles.detailDesc}>
                  {diagResults?.battery ? `Lectura voltaje: ${diagResults.battery}` : (data?.voltage ? `${data.voltage.toFixed(1)}V` : 'Escaneando...')}
                </Text>
              </View>
            </View>

            {(diagResults?.dtcs || data?.dtc_codes)?.length > 0 && (
              <View style={[styles.detailItem, { marginTop: 20 }]}>
                <View style={[styles.detailIcon, { backgroundColor: `${COLORS.error}22` }]}><Text>⚠️</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailTitle, { color: COLORS.error }]}>Códigos DTC Activos:</Text>
                  {(diagResults?.dtcs || data?.dtc_codes).map((c: string) => (
                    <Text key={c} style={[styles.detailDesc, { color: COLORS.error, fontWeight: 'bold' }]}>
                      • {c}: {c === 'P0171' ? 'Mezcla pobre (System too lean)' : c === 'P0301' ? 'Falla en cilindro 1 (Misfire)' : 'Error genérico de motor. Requiere revisión.'}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, loadingDiag && { opacity: 0.5 }, globalStyles.neonGlow]}
          onPress={runDiagnostic}
          disabled={loadingDiag}
        >
          {loadingDiag ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text style={styles.actionBtnText}>EJECUTAR DIAGNÓSTICO IA</Text>
          )}
        </TouchableOpacity>

        {(diagResults?.dtcs?.length > 0 || (data?.dtc_codes && data.dtc_codes.length > 0)) && (
          <TouchableOpacity
            style={[styles.clearBtn, loadingDiag && { opacity: 0.5 }]}
            onPress={clearCodes}
            disabled={loadingDiag}
          >
            <Text style={styles.clearBtnText}>🗑️ BORRAR CÓDIGOS DE MOTOR (MODO 04)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: COLORS.outline, backgroundColor: COLORS.surface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: COLORS.onSurface, fontSize: 18, fontFamily: FONTS.grotesk, letterSpacing: 2 },
  content: { padding: 20 },
  mainTitle: { color: COLORS.onSurface, fontSize: 32, fontFamily: FONTS.grotesk },
  subtitle: { color: COLORS.onSurfaceVariant, fontSize: 16, fontFamily: FONTS.inter, marginBottom: 25 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.outline, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardLabel: { color: COLORS.onSurfaceVariant, fontSize: 11, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  liveTag: { color: COLORS.success, fontSize: 10, fontFamily: FONTS.monoBold },
  chart: { marginVertical: 8, borderRadius: 16, marginLeft: -20 },
  sectionHeader: { color: COLORS.primaryDim, fontSize: 12, fontFamily: FONTS.monoBold, marginBottom: 15, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  gridItem: { width: '48%', backgroundColor: COLORS.surface, borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: COLORS.outline },
  gridItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryContainer, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5 },
  gridLabel: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 1, marginBottom: 8 },
  gridValue: { color: COLORS.onSurface, fontSize: 24, fontFamily: FONTS.grotesk },
  gridUnit: { color: COLORS.onSurfaceVariant, fontSize: 12, fontFamily: FONTS.mono },
  minMaxText: { color: COLORS.primaryDim, fontSize: 10, fontFamily: FONTS.mono, marginTop: 8 },
  diagnosisBox: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderLeftWidth: 4, borderLeftColor: COLORS.primary, marginBottom: 20, borderWidth: 1, borderColor: COLORS.outline },
  diagnosisDetails: { marginTop: 10 },
  engineTag: { backgroundColor: COLORS.surfaceHighest, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: COLORS.outline },
  engineTagText: { color: COLORS.primary, fontSize: 18, fontFamily: FONTS.monoBold, letterSpacing: 2 },
  detailItem: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { width: 40, height: 40, backgroundColor: COLORS.surfaceHighest, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: COLORS.outline },
  detailTitle: { color: COLORS.onSurface, fontSize: 14, fontFamily: FONTS.interMedium },
  detailDesc: { color: COLORS.onSurfaceVariant, fontSize: 12, fontFamily: FONTS.inter, lineHeight: 18 },
  actionBtn: { borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 15, backgroundColor: COLORS.primaryContainer },
  actionBtnText: { color: COLORS.primary, fontFamily: FONTS.monoBold, letterSpacing: 2 },
  clearBtn: { backgroundColor: `${COLORS.error}22`, borderWidth: 1, borderColor: COLORS.error, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  clearBtnText: { color: COLORS.error, fontFamily: FONTS.monoBold, letterSpacing: 1 },
});
