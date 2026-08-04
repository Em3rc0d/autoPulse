// src/hooks/useOBDPolling.ts
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { bluetoothOBD } from '../services/bluetoothOBD';
import { localStore } from '../services/localStore';
import { telemetryAPI } from '../services/api';
import { edgeAnomalyDetector } from '../services/anomalyDetector';
import { telemetryBus } from '../services/telemetryBus';

export function useOBDPolling(vehicleId: string, ecoMode: boolean = false) {
  const intervalMs = ecoMode ? 5000 : 1000;
  const [data, setData]       = useState<any>(null);
  const [error, setError]     = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [alerts, setAlerts]   = useState<any[]>([]);
  const [tripActive, _setTripActive] = useState(false);
  const tripActiveRef = useRef(false);
  const setTripActive = (val: boolean) => {
    tripActiveRef.current = val;
    _setTripActive(val);
  };
  const [tripSummary, setTripSummary] = useState<any>(null);
  const [minMax, setMinMax] = useState<Record<string, { min: number, max: number }>>({});
  const timer = useRef<any>(null);
  const pollingRef = useRef<boolean>(false);
  const lastSpeedRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const tripStartTimeRef = useRef<number | null>(null);
  const consecutiveZeroRpm = useRef(0);

  const startTrip = () => {
    setTripActive(true);
    setTripSummary(null);
    tripStartTimeRef.current = Date.now();
    console.log('🚀 Viaje Detectado: Motor Encendido');
  };

  const endTrip = async (finalData: any) => {
    if (!tripActiveRef.current) return;
    setTripActive(false);

    const durationMin = tripStartTimeRef.current ? (Date.now() - tripStartTimeRef.current) / 60000 : 0;
    const insights = await localStore.getInsights(vehicleId);

    // Eco-Score Calculation
    let ecoScore = 100;
    const hardBrakes = insights?.hard_brakes || 0;
    const avgRpm = finalData?.rpm || 0;
    const maxSpeed = finalData?.speed || 0;

    ecoScore -= (hardBrakes * 5);
    if (avgRpm > 3000) ecoScore -= ((avgRpm - 3000) / 100);
    if (maxSpeed > 100) ecoScore -= ((maxSpeed - 100) * 0.5);
    ecoScore = Math.max(0, Math.min(100, Math.round(ecoScore)));

    const summary = {
      duration: durationMin.toFixed(1),
      maxSpeed: maxSpeed,
      avgRpm: avgRpm,
      hardBrakes: hardBrakes,
      fuelCost: insights?.fuel_cost || 0,
      distance: insights?.virtual_odometer_km || 0,
      ecoScore: ecoScore
    };

    setTripSummary(summary);
    await localStore.saveTrip(summary);

    // Save parking location automatically
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        await localStore.saveParkingLocation(loc.coords.latitude, loc.coords.longitude);
      }
    } catch (e) {}

    console.log('⏹ Viaje Finalizado: Motor Apagado');
  };

  const evaluateAlerts = (reading: any, hardBraking: boolean) => {
    const newAlerts = [];
    if (reading.coolant_temp > 95) newAlerts.push({ message: 'Alta temperatura', type: 'danger' });
    if (reading.rpm > 5500) newAlerts.push({ message: 'RPM Crítico', type: 'warning' });
    if (hardBraking) newAlerts.push({ message: 'Frenada Brusca', type: 'danger' });

    // Edge Anomaly Detection
    const anomaly = edgeAnomalyDetector.evaluate(reading);
    if (anomaly.isAnomaly) {
      anomaly.reasons.forEach(r => newAlerts.push({ message: r, type: 'danger' }));
    }

    setAlerts(newAlerts);
  };

  const startPolling = async () => {
    if (!bluetoothOBD.isConnected()) {
      setError('Bluetooth desconectado');
      return;
    }
    setPolling(true);
    setError(null);

    const poll = async () => {
      if (!pollingRef.current) return;
      try {
        const reading: any = await bluetoothOBD.readAll(vehicleId);
        if (!reading) throw new Error("Sin respuesta del adaptador");

        if (!reading.has_data) {
          setError("Conectado pero sin datos (¿Ignición ON?)");
          setData(null);
        } else {
          setError(null);
          const rpm = reading.rpm || 0;
          const currentSpeed = reading.speed || 0;
          const now = Date.now();

          // --- AUTOMATIC TRIP DETECTION ---
          if (!tripActiveRef.current && rpm > 400) {
            startTrip();
          } else if (tripActiveRef.current && rpm < 50) {
            consecutiveZeroRpm.current++;
            if (consecutiveZeroRpm.current > 3) {
              await endTrip(reading);
              consecutiveZeroRpm.current = 0;
            }
          } else {
            consecutiveZeroRpm.current = 0;
          }

          let hardBraking = false;
          if (lastSpeedRef.current !== null && lastTimeRef.current !== null) {
            const dtSeconds = (now - lastTimeRef.current) / 1000;
            const avgSpeedMps = ((currentSpeed + lastSpeedRef.current) / 2) * (1000 / 3600);
            const distanceMeters = avgSpeedMps * dtSeconds;
            if (distanceMeters > 0 && tripActiveRef.current) await localStore.addDistance(distanceMeters);
            if (lastSpeedRef.current - currentSpeed > 15) hardBraking = true;
          }

          lastSpeedRef.current = currentSpeed;
          lastTimeRef.current = now;

          setData({ ...reading, hard_braking: hardBraking });
          evaluateAlerts(reading, hardBraking);

          // Emitir a través del Event Bus de alto rendimiento para UI Neumórfica a 60FPS
          telemetryBus.emit('telemetry_update', { ...reading, hard_braking: hardBraking });

          // Update MinMax global hook state
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
            checkUpdate('speed', currentSpeed);
            checkUpdate('rpm', rpm);
            checkUpdate('coolant', reading.coolant_temp);
            checkUpdate('load', reading.engine_load);
            checkUpdate('throttle', reading.throttle_pos);
            checkUpdate('maf', reading.maf);
            checkUpdate('voltage', reading.voltage);
            return next;
          });

          if (tripActiveRef.current) {
            await localStore.saveTelemetry(vehicleId, reading);
            try { telemetryAPI.ingest(reading).catch(() => {}); } catch (e) {}

            // Si el Webhook está configurado, enviar
            telemetryBus.emit('webhook_sync', reading);
          }
        }
      } catch (e: any) {
        setError(e.message);
        if (tripActiveRef.current) endTrip(null);
      }

      // Schedule next poll only AFTER this one finishes
      if (pollingRef.current) {
        timer.current = setTimeout(poll, intervalMs);
      }
    };

    pollingRef.current = true;
    poll();
  };

  const stopPolling = () => {
    pollingRef.current = false;
    if (timer.current) clearTimeout(timer.current);
    setPolling(false);
    if (tripActiveRef.current) endTrip(null);
  };

  useEffect(() => {
    startPolling(); // Intentar al entrar
    const checker = setInterval(() => {
      if (bluetoothOBD.isConnected() && !pollingRef.current) {
        startPolling();
      } else if (!bluetoothOBD.isConnected() && pollingRef.current) {
        stopPolling();
        setError('Bluetooth desconectado');
      }
    }, 2000);

    return () => {
      clearInterval(checker);
      stopPolling();
    };
  }, []);

  return { data, error, polling, alerts, tripActive, tripSummary, minMax, closeSummary: () => setTripSummary(null) };
}
