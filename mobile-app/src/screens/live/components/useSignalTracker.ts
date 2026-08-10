import { useState, useEffect, useRef, useMemo } from 'react';
import { AdvisoryStateTracker, SignalSessionStatsTracker, SignalQualityEvaluator } from '../../../domain/telemetry/AdvisoryStateTracker';
import { SignalAdvisoryProfile, SignalAdvisoryState, SignalSessionStats, DataQuality, AdvisoryContext } from '../../../domain/telemetry/SignalAdvisory';

export function useSignalTracker(signalId: string, profile: SignalAdvisoryProfile, expectedPollIntervalMs: number = 300) {
  const advisoryTracker = useMemo(() => new AdvisoryStateTracker(profile), [profile]);
  const statsTracker = useMemo(() => new SignalSessionStatsTracker(), []);

  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [explicitQuality, setExplicitQuality] = useState<DataQuality | null>(null);

  const [advisoryState, setAdvisoryState] = useState<SignalAdvisoryState>(advisoryTracker.evaluate(0, 'UNAVAILABLE'));
  const [stats, setStats] = useState<SignalSessionStats>(statsTracker.getStats());

  const lastUpdateRef = useRef<number | null>(null);
  const valueRef = useRef<number | null>(null);
  const explicitQualityRef = useRef<DataQuality | null>(null);
  const contextRef = useRef<AdvisoryContext | undefined>(undefined);

  const update = (value: number | null, quality: DataQuality | null = null, context?: AdvisoryContext) => {
    const now = Date.now();

    // 1. Clasificar calidad
    const evaluatedQuality = SignalQualityEvaluator.evaluate(
      value,
      quality,
      signalId,
      lastUpdateRef.current,
      now,
      expectedPollIntervalMs
    );

    // 2. Actualizar referencias
    valueRef.current = value;
    explicitQualityRef.current = quality;
    if (value !== null && evaluatedQuality !== 'INVALID' && evaluatedQuality !== 'UNAVAILABLE' && evaluatedQuality !== 'DEGRADED') {
      lastUpdateRef.current = now;
    }

    // 3. Actualizar stats si hay valor
    if (value !== null) {
      statsTracker.record(value, evaluatedQuality, signalId);
    }

    contextRef.current = context;

    // 4. Calcular advisory candidate y confirmar histéresis
    const newState = advisoryTracker.evaluate(value ?? 0, evaluatedQuality, context);

    // 5. Publicar todo atómicamente
    setCurrentValue(value);
    setExplicitQuality(quality);
    setStats(prev => {
      const newStats = statsTracker.getStats();
      if (
        prev.validReadingCount === newStats.validReadingCount &&
        prev.validMinObserved === newStats.validMinObserved &&
        prev.validMaxObserved === newStats.validMaxObserved &&
        prev.engineStoppedObserved === newStats.engineStoppedObserved &&
        prev.suspectValuesObserved === newStats.suspectValuesObserved
      ) {
        return prev;
      }
      return newStats;
    });
    setAdvisoryState(prev => {
      if (
        prev.advisory === newState.advisory &&
        prev.quality === newState.quality &&
        prev.color === newState.color &&
        prev.badgeText === newState.badgeText
      ) {
        return prev;
      }
      return newState;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // El intervalo temporal solo evalúa STALE y avanza histéresis
      const now = Date.now();
      const quality = SignalQualityEvaluator.evaluate(
        valueRef.current,
        explicitQualityRef.current,
        signalId,
        lastUpdateRef.current,
        now,
        expectedPollIntervalMs
      );

      const newState = advisoryTracker.evaluate(valueRef.current ?? 0, quality, contextRef.current);
      setAdvisoryState(prev => {
        if (
          prev.advisory === newState.advisory &&
          prev.quality === newState.quality &&
          prev.color === newState.color &&
          prev.badgeText === newState.badgeText
        ) {
          return prev;
        }
        return newState;
      });
      // NO actualizamos validReadingCount ni min/max
    }, 100);

    return () => clearInterval(interval);
  }, [advisoryTracker, signalId, expectedPollIntervalMs]);

  const getSnapshot = () => {
    return {
      value: valueRef.current,
      quality: advisoryState.quality, // AdvisoryState might be stale in closure, need to read current
      // Wait, explicitQualityRef is current, but we need the evaluated quality
      // Actually we can just re-evaluate it right now:
      observedAt: lastUpdateRef.current
    };
  };

  const getContextSnapshot = () => ({
    value: valueRef.current,
    quality: SignalQualityEvaluator.evaluate(
        valueRef.current,
        explicitQualityRef.current,
        signalId,
        lastUpdateRef.current,
        Date.now(),
        expectedPollIntervalMs
    ),
    observedAt: lastUpdateRef.current
  });

  return {
    value: currentValue,
    advisoryState,
    stats,
    update,
    getContextSnapshot,
    lastUpdateAt: lastUpdateRef.current,
    profile
  };
}
