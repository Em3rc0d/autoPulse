import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AvailableSignal, DrivingMode, SignalQuality } from '../../../domain/driver-intelligence';
import { buildLiveSignalInventory } from './LiveSignalInventory';

interface DriverModeContextValue {
  selectedMode: DrivingMode;
  setSelectedMode: (mode: DrivingMode) => void;
  availableSignals: AvailableSignal[];
  reportSignalQuality: (signalId: string, quality: SignalQuality) => void;
}

const DriverModeContext = createContext<DriverModeContextValue | null>(null);

interface ProviderProps {
  supportedPids?: readonly string[];
  children: React.ReactNode;
}

export function DriverModeProvider({ supportedPids = [], children }: ProviderProps) {
  const [selectedMode, setSelectedMode] = useState<DrivingMode>('ESSENTIAL');
  const [observedQualities, setObservedQualities] = useState<Record<string, SignalQuality>>({});

  const availableSignals = useMemo(
    () => buildLiveSignalInventory(
      supportedPids,
      Object.entries(observedQualities).map(([signalId, quality]) => ({ signalId, quality })),
    ),
    [supportedPids, observedQualities],
  );

  const reportSignalQuality = (signalId: string, quality: SignalQuality) => {
    setObservedQualities(current => current[signalId] === quality
      ? current
      : { ...current, [signalId]: quality });
  };

  return (
    <DriverModeContext.Provider value={{
      selectedMode,
      setSelectedMode,
      availableSignals,
      reportSignalQuality,
    }}>
      {children}
    </DriverModeContext.Provider>
  );
}

export function useDriverMode() {
  const context = useContext(DriverModeContext);
  if (!context) {
    throw new Error('useDriverMode must be used inside DriverModeProvider');
  }
  return context;
}
