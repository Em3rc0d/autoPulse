import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AvailableSignal, DrivingMode, SignalOrigin, SignalQuality } from '../../../domain/driver-intelligence';
import type { MountContinuity } from '../../../domain/driver-intelligence/DrivingEvidenceTrust';
import type { SignalAdvisoryStatus, SignalCalibrationStatus } from '../../../domain/telemetry/SignalAdvisory';
import { buildLiveSignalInventory } from './LiveSignalInventory';

export interface DriverSignalObservation {
  signalId: string;
  value: number;
  unit?: string;
  quality: SignalQuality;
  origin: SignalOrigin;
  advisory?: SignalAdvisoryStatus;
  calibration?: SignalCalibrationStatus;
  mountContinuity?: MountContinuity;
  firstValue: number;
  firstObservedAt: number;
  observedAt: number;
  sampleCount: number;
}

interface DriverModeContextValue {
  selectedMode: DrivingMode;
  setSelectedMode: (mode: DrivingMode) => void;
  availableSignals: AvailableSignal[];
  observations: Record<string, DriverSignalObservation>;
  reportSignalQuality: (signalId: string, quality: SignalQuality) => void;
  reportSignalObservation: (observation: Omit<DriverSignalObservation, 'firstValue' | 'firstObservedAt' | 'sampleCount'>) => void;
  reportDeviceSignal: (signal: AvailableSignal) => void;
}

const DriverModeContext = createContext<DriverModeContextValue | null>(null);

interface ProviderProps {
  supportedPids?: readonly string[];
  children: React.ReactNode;
}

export function DriverModeProvider({ supportedPids = [], children }: ProviderProps) {
  const [selectedMode, setSelectedMode] = useState<DrivingMode>('ESSENTIAL');
  const [observedQualities, setObservedQualities] = useState<Record<string, SignalQuality>>({});
  const [deviceSignals, setDeviceSignals] = useState<Record<string, AvailableSignal>>({});
  const [observations, setObservations] = useState<Record<string, DriverSignalObservation>>({});

  const availableSignals = useMemo(() => {
    const vehicleSignals = buildLiveSignalInventory(
      supportedPids,
      Object.entries(observedQualities).map(([signalId, quality]) => ({ signalId, quality })),
    );
    const combined = new Map(vehicleSignals.map(signal => [signal.signalId, signal]));
    Object.values(deviceSignals).forEach(signal => combined.set(signal.signalId, signal));
    return Array.from(combined.values());
  }, [supportedPids, observedQualities, deviceSignals]);

  const reportSignalQuality = (signalId: string, quality: SignalQuality) => {
    setObservedQualities(current => current[signalId] === quality
      ? current
      : { ...current, [signalId]: quality });
  };

  const reportSignalObservation: DriverModeContextValue['reportSignalObservation'] = observation => {
    setObservations(current => {
      const previous = current[observation.signalId];
      return {
        ...current,
        [observation.signalId]: {
          ...observation,
          firstValue: previous?.firstValue ?? observation.value,
          firstObservedAt: previous?.firstObservedAt ?? observation.observedAt,
          sampleCount: (previous?.sampleCount ?? 0) + 1,
        },
      };
    });
    reportSignalQuality(observation.signalId, observation.quality);
  };

  const reportDeviceSignal = (signal: AvailableSignal) => {
    setDeviceSignals(current => {
      const previous = current[signal.signalId];
      if (
        previous?.quality === signal.quality &&
        previous?.origin === signal.origin &&
        previous?.unit === signal.unit
      ) return current;
      return { ...current, [signal.signalId]: signal };
    });
  };

  return (
    <DriverModeContext.Provider value={{
      selectedMode,
      setSelectedMode,
      availableSignals,
      observations,
      reportSignalQuality,
      reportSignalObservation,
      reportDeviceSignal,
    }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useOptionalDriverMode() {
  return useContext(DriverModeContext);
}

export function useDriverMode() {
  const context = useOptionalDriverMode();
  if (!context) {
    throw new Error('useDriverMode must be used inside DriverModeProvider');
  }
  return context;
}
