// src/screens/DashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, Linking, Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOBDPolling } from '../hooks/useOBDPolling';
import { localStore } from '../services/localStore';
import { vehiclesAPI } from '../services/api';
import { COLORS, FONTS } from '../styles/theme';

import { LineChart } from 'react-native-chart-kit';

const VEHICLE_ID = 'mi-vehiculo-default';
const VEHICLE_NAME = 'INTELLIGENT CORE';
const screenWidth = Dimensions.get("window").width;


function SmoothNumber({ value, isDecimal = false, style }: any) {
  const [displayValue, setDisplayValue] = useState(value || 0);

  useEffect(() => {
    let current = displayValue;
    const diff = (value || 0) - current;
    if (diff === 0) return;

    const steps = 10;
    const stepValue = diff / steps;
    let stepCount = 0;

    const interval = setInterval(() => {
      stepCount++;
      current += stepValue;
      setDisplayValue(isDecimal ? parseFloat(current.toFixed(1)) : Math.round(current));
      if (stepCount >= steps) {
        clearInterval(interval);
        setDisplayValue(value || 0);
      }
    }, 40); // 400ms transition time
    return () => clearInterval(interval);
  }, [value]);

  return <Text style={style}>{isDecimal ? displayValue.toFixed(1) : displayValue}</Text>;
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [ecoMode, setEcoMode] = useState(false);
  const { data, error, polling, tripActive, tripSummary, closeSummary, minMax } = useOBDPolling(VEHICLE_ID, ecoMode);
  const [insights, setInsights] = useState<any>(null);
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [guardianMode, setGuardianMode] = useState(false);

  // Color logic
  const getSpeedColor = (val: number) => val > 130 ? '#FF453A' : (val > 100 ? '#FF9F0A' : '#00D1FF');
  const getRpmColor = (val: number) => val > 5000 ? '#FF453A' : (val > 3000 ? '#FF9F0A' : '#00D1FF');
  const getCoolantColor = (val: number) => val > 110 ? '#FF453A' : (val > 100 ? '#FF9F0A' : '#00D1FF');
  const getLoadColor = (val: number) => val > 80 ? '#FF453A' : (val > 60 ? '#FF9F0A' : '#32D74B');
  const getVoltageColor = (val: number) => val < 12 ? '#FF453A' : (val < 13.5 ? '#FF9F0A' : '#32D74B');

  useEffect(() => {
    localStore.getInsights(VEHICLE_ID).then(setInsights).catch(() => {});
    vehiclesAPI.get(VEHICLE_ID).then(v => {
      setVehicleData(v);
      if (v?.guardian_mode_active) setGuardianMode(true);
    }).catch(() => {});
  }, [polling]);

  const toggleGuardian = () => {
    setGuardianMode(!guardianMode);
    // TODO: Send to API to persist
  };

  const getDocStatus = (dateStr: string) => {
    if (!dateStr) return { status: 'NO DATA', color: '#8E8E93' };
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    if (days < 0) return { status: 'VENCIDO', color: '#FF453A' };
    if (days <= 15) return { status: `${days}d`, color: '#FF9F0A' };
    return { status: 'OK', color: '#32D74B' };
  };

  // Gauge rotation animation based on RPM
  const rpmSpin = new Animated.Value(0);
  useEffect(() => {
    Animated.timing(rpmSpin, {
      toValue: data?.rpm || 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [data?.rpm]);

  const spin = rpmSpin.interpolate({
    inputRange: [0, 8000],
    outputRange: ['-45deg', '225deg'] // Spins around based on RPM
  });

  return (
    <View style={styles.container}>
      {/* STATUS PILL & ECO MODE */}
      <View style={styles.statusPillContainer}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: error ? '#FF453A' : '#00D1FF' }]} />
          <View>
            <Text style={[styles.statusText, error && { color: '#FF453A' }]}>
              {error ? 'ERROR DE SISTEMA' : (tripActive ? 'SISTEMA ACTIVO' : 'SISTEMA NOMINAL')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.guardianBtn, guardianMode && styles.guardianBtnActive]}
            onPress={toggleGuardian}
          >
            <Text style={[styles.guardianText, guardianMode && { color: '#000' }]}>
              {guardianMode ? '🛡️ GUARDIÁN ACTIVO' : '🛡️ ACTIVAR GUARDIÁN'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ecoBtn, ecoMode && styles.ecoBtnActive]}
            onPress={() => setEcoMode(!ecoMode)}
          >
            <Text style={[styles.ecoText, ecoMode && { color: '#000' }]}>
              {ecoMode ? '🍃 ECO MODE ON' : '🍃 ECO MODE'}
            </Text>
          </TouchableOpacity>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* CENTRAL GAUGE */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeOuterRing}>
            <Animated.View style={[styles.gaugeInnerRing, { transform: [{ rotate: spin }] }]}>
              {/* This is the rotating arc effect */}
              <View style={styles.gaugeArc} />
            </Animated.View>
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <SmoothNumber value={data?.speed ?? 0} style={[styles.speedValue, { color: getSpeedColor(data?.speed || 0) }]} />
              <Text style={styles.speedLabel}>KM/H</Text>
              <View style={styles.rpmRow}>
                <SmoothNumber value={(data?.rpm || 0) / 1000} isDecimal style={[styles.rpmValue, { color: getRpmColor(data?.rpm || 0) }]} />
                <Text style={styles.rpmLabel}>x1000 RPM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* CARDS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>BATERÍA / ALTERNADOR</Text>
            <Text style={{ fontSize: 18 }}>🔋</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={[styles.cardValue, { color: getVoltageColor(data?.voltage || 0) }]}>{data?.voltage ? data.voltage.toFixed(1) : '--'}<Text style={styles.cardUnit}>V</Text></Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: data?.voltage ? `${Math.min(100, (data.voltage / 14.5) * 100)}%` : '0%', backgroundColor: getVoltageColor(data?.voltage || 0) }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
            <Text style={styles.cardSubText}>{data?.voltage && data.voltage > 13.5 ? 'Alternador cargando' : 'Batería en reposo'}</Text>
            <Text style={styles.minMaxText}>Óptimo: 13.5-14.5V</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>REFRIGERANTE</Text>
            <Text style={{ fontSize: 18 }}>🌡️</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={[styles.cardValue, { color: getCoolantColor(data?.coolant_temp || 0) }]}>{data?.coolant_temp ?? '--'}<Text style={styles.cardUnit}>°C</Text></Text>
          </View>
          <View style={styles.segmentedBar}>
            <View style={[styles.segment, { backgroundColor: getCoolantColor(data?.coolant_temp || 0) }]} />
            <View style={[styles.segment, { backgroundColor: getCoolantColor(data?.coolant_temp || 0) }]} />
            <View style={[styles.segment, { backgroundColor: '#2C2C2E' }]} />
            <View style={[styles.segment, { backgroundColor: '#2C2C2E' }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Text style={[styles.minMaxText, { color: COLORS.success }]}>Óptimo: 90-95°C</Text>
            <Text style={[styles.minMaxText, { color: COLORS.warning }]}>Seguro: 85-105°C</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>COSTO VIAJE</Text>
            <Text style={{ fontSize: 18 }}>💵</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardValue}><Text style={styles.cardUnit}>$</Text>{insights?.fuel_cost?.toFixed(2) || '0.00'}</Text>
          </View>
          <Text style={styles.cardSubText}>Métrica en tiempo real</Text>
        </View>

        {/* ERROR CODES BANNER (DTCs) */}
        {data?.dtc_codes && data.dtc_codes.length > 0 && (
          <View style={[styles.card, { borderColor: '#FF453A', backgroundColor: '#3A000022' }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: '#FF453A' }]}>CHECK ENGINE (DTC DETECTADOS)</Text>
              <Text style={{ fontSize: 18 }}>⚠️</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {data.dtc_codes.map((code: string) => (
                <View key={code} style={{ backgroundColor: '#FF453A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{code}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.cardSubText, { color: '#FF453A', marginTop: 10 }]}>Ve al Mecánico IA para un diagnóstico.</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
          {/* ENGINE LOAD */}
          <View style={[styles.card, { width: '48%', marginBottom: 0 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>CARGA MOTOR</Text>
              <Text style={{ fontSize: 14 }}>⚙️</Text>
            </View>
            <View style={styles.cardMain}>
              <Text style={[styles.cardValue, { color: getLoadColor(data?.engine_load || 0) }]}>{data?.engine_load ? data.engine_load.toFixed(1) : '--'}<Text style={styles.cardUnit}>%</Text></Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${data?.engine_load || 0}%`, backgroundColor: getLoadColor(data?.engine_load || 0) }]} />
            </View>
            <Text style={styles.minMaxText}>Seguro: &lt;80%</Text>
          </View>

          {/* THROTTLE POS */}
          <View style={[styles.card, { width: '48%', marginBottom: 0 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>ACELERADOR</Text>
              <Text style={{ fontSize: 14 }}>🚀</Text>
            </View>
            <View style={styles.cardMain}>
              <Text style={[styles.cardValue, { color: getLoadColor(data?.throttle_pos || 0) }]}>{data?.throttle_pos ? data.throttle_pos.toFixed(1) : '--'}<Text style={styles.cardUnit}>%</Text></Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${data?.throttle_pos || 0}%`, backgroundColor: getLoadColor(data?.throttle_pos || 0) }]} />
            </View>
            <Text style={styles.minMaxText}>Límite Seguro: &lt;85%</Text>
          </View>
        </View>

        {/* MASS AIR FLOW (MAF) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>MASS AIR FLOW (MAF)</Text>
            <Text style={{ fontSize: 18 }}>💨</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardValue}>{data?.maf ? data.maf.toFixed(2) : '--'}<Text style={styles.cardUnit}>g/s</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardSubText}>Flujo de aire entrando al motor</Text>
            <Text style={styles.minMaxText}>Rel. 14.7:1 AFR</Text>
          </View>
        </View>

        {/* DOCUMENTS WIDGET */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>DOCUMENTACIÓN (PERÚ)</Text>
            <Text style={{ fontSize: 18 }}>🇵🇪</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.reportLabel}>SOAT</Text>
              <Text style={{ color: getDocStatus(vehicleData?.soat_expiration).color, fontWeight: '800' }}>
                {getDocStatus(vehicleData?.soat_expiration).status}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.reportLabel}>CITV (MTC)</Text>
              <Text style={{ color: getDocStatus(vehicleData?.citv_expiration).color, fontWeight: '800' }}>
                {getDocStatus(vehicleData?.citv_expiration).status}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.reportLabel}>GNV/GLP</Text>
              <Text style={{ color: getDocStatus(vehicleData?.gnv_expiration).color, fontWeight: '800' }}>
                {getDocStatus(vehicleData?.gnv_expiration).status}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSubText}>Auto-verificado por AutoPulse AI</Text>
        </View>

        {/* TRIP SUMMARY OVERLAY */}
        {tripSummary && (
          <View style={styles.reportOverlay}>
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>📊 RESUMEN DEL VIAJE</Text>
              <View style={styles.reportGrid}>
                <View style={styles.reportItem}><Text style={styles.reportLabel}>TIEMPO</Text><Text style={styles.reportValue}>{tripSummary.duration}m</Text></View>
                <View style={styles.reportItem}><Text style={styles.reportLabel}>DIST</Text><Text style={styles.reportValue}>{tripSummary.distance.toFixed(1)}km</Text></View>
                <View style={[styles.reportItem, { width: '100%', backgroundColor: '#00D1FF22', borderColor: '#00D1FF', borderWidth: 1 }]}>
                  <Text style={[styles.reportLabel, { color: '#00D1FF' }]}>PUNTAJE ECO-DRIVE</Text>
                  <Text style={[styles.reportValue, { fontSize: 32, color: '#00D1FF' }]}>{tripSummary.ecoScore} / 100</Text>
                  <Text style={{ color: '#FFF', fontSize: 11, marginTop: 5 }}>
                    {tripSummary.ecoScore > 80 ? '¡Excelente conducción! Estás ahorrando combustible.' : 'Frenadas bruscas o aceleraciones detectadas. Intenta manejar más suave.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={closeSummary}><Text style={styles.closeBtnText}>CERRAR</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  statusPillContainer: { alignItems: 'center', marginTop: 50, marginBottom: 20 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.outline, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: COLORS.primary, fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  guardianBtn: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.warning },
  guardianBtnActive: { backgroundColor: COLORS.warning, shadowColor: COLORS.warning, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 },
  guardianText: { color: COLORS.warning, fontSize: 10, fontFamily: FONTS.monoBold },
  ecoBtn: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.success },
  ecoBtnActive: { backgroundColor: COLORS.success, shadowColor: COLORS.success, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10 },
  ecoText: { color: COLORS.success, fontSize: 10, fontFamily: FONTS.monoBold },
  scrollContent: { padding: 20 },
  gaugeContainer: { alignItems: 'center', marginVertical: 30 },
  gaugeOuterRing: { width: 260, height: 260, borderRadius: 130, backgroundColor: COLORS.surface, borderTopWidth: 2, borderLeftWidth: 2, borderBottomWidth: 3, borderRightWidth: 3, borderTopColor: COLORS.outline, borderLeftColor: COLORS.outline, borderBottomColor: '#0B0C11', borderRightColor: '#0B0C11', justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 15 },
  gaugeInnerRing: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: COLORS.outline, justifyContent: 'center', alignItems: 'center' },
  gaugeArc: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderTopWidth: 6, borderRightWidth: 6, borderColor: COLORS.primary, borderTopColor: COLORS.primary, borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', transform: [{ rotate: '45deg' }] },
  speedValue: { color: COLORS.onSurface, fontSize: 80, fontFamily: FONTS.grotesk, letterSpacing: -2, textShadowColor: COLORS.primary, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  speedLabel: { color: COLORS.onSurfaceVariant, fontSize: 12, fontFamily: FONTS.monoBold, marginTop: -10 },
  rpmRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  rpmValue: { color: COLORS.primary, fontSize: 24, fontFamily: FONTS.grotesk },
  rpmLabel: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold, marginLeft: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: COLORS.outline, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { color: COLORS.onSurfaceVariant, fontSize: 11, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  cardMain: { marginBottom: 10 },
  cardValue: { color: COLORS.onSurface, fontSize: 36, fontFamily: FONTS.grotesk },
  cardUnit: { fontSize: 14, color: COLORS.onSurfaceVariant, fontFamily: FONTS.mono, marginLeft: 4 },
  progressBarContainer: { height: 4, backgroundColor: '#0B0C11', borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.outline },
  progressBar: { height: '100%', shadowColor: COLORS.onSurface, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
  segmentedBar: { flexDirection: 'row', justifyContent: 'space-between', height: 4 },
  segment: { flex: 1, marginHorizontal: 2, borderRadius: 2, shadowColor: COLORS.onSurface, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
  cardSubText: { color: COLORS.primary, fontSize: 10, fontFamily: FONTS.inter },
  reportOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,20,23,0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 },
  reportCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, width: '100%', borderWidth: 2, borderColor: COLORS.primary },
  reportTitle: { color: COLORS.primary, fontSize: 20, fontFamily: FONTS.grotesk, textAlign: 'center', marginBottom: 20 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  reportItem: { width: '45%', marginBottom: 20, backgroundColor: COLORS.surfaceHighest, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.outline },
  reportLabel: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold, marginBottom: 4 },
  reportValue: { color: COLORS.onSurface, fontSize: 18, fontFamily: FONTS.grotesk },
  closeBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, marginTop: 10, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  closeBtnText: { color: '#000', fontFamily: FONTS.monoBold, fontSize: 14 },
  errorText: { color: COLORS.error, textAlign: 'center', fontSize: 11, fontFamily: FONTS.inter },
  minMaxText: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.mono, marginTop: 5 },
});
