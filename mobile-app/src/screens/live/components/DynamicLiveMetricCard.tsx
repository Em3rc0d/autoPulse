import React, { useImperativeHandle, forwardRef } from 'react';
import { View } from 'react-native';
import { LiveMetricCard } from './LiveMetricCard';
import { useSignalTracker } from './useSignalTracker';
import { LiveSignalSnapshot } from '../../../infrastructure/hooks/useLiveSignalTracking';
import { DEMO_PROFILES } from '../../../domain/telemetry/SignalProfiles';
import { AppConfig } from '../../../application/config';
import { DataQuality } from '../../../domain/telemetry/SignalAdvisory';

export interface DynamicLiveMetricCardProps {
  signal: LiveSignalSnapshot;
  onSelect: (signalId: string) => void;
  isSelected: boolean;
}

export interface DynamicLiveMetricCardRef {
  update: (value: number | null, quality: DataQuality | null, context?: any) => void;
  getContextSnapshot: () => any;
  getStats: () => any;
}

export const formatSignalLabel = (canonical: string) => {
  switch (canonical) {
    case 'ENGINE_RPM': return 'RPM';
    case 'VEHICLE_SPEED': return 'SPEED';
    case 'ENGINE_COOLANT': return 'COOLANT';
    case 'CONTROL_MODULE_VOLTAGE': return 'ECU VOLT';
    case 'ADAPTER_VOLTAGE': return 'ADAPTER VOLT';
    default: return canonical.replace(/_/g, ' ');
  }
};

/**
 * Encapsulates the tracking hook for a single dynamic signal.
 */
export const DynamicLiveMetricCard = forwardRef<DynamicLiveMetricCardRef, DynamicLiveMetricCardProps>(({ signal, onSelect, isSelected }, ref) => {
  const useGeneric = AppConfig.GENERIC_ADVISORY_PROFILES_ENABLED;
  const profile = DEMO_PROFILES[signal.signalDefinitionId] || {
    vehicleId: 'demo',
    signalId: signal.signalDefinitionId,
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'NOT_CALIBRATED',
    hysteresisMs: 3000,
    sustainDurationMs: 2000,
    bands: [],
    referenceRanges: []
  };

  const tracker = useSignalTracker(
    signal.signalDefinitionId,
    useGeneric ? profile : { ...profile, bands: [], calibrationStatus: 'NOT_CALIBRATED' },
    1500
  );

  useImperativeHandle(ref, () => ({
    update: tracker.update,
    getContextSnapshot: tracker.getContextSnapshot,
    getStats: () => tracker.stats
  }));
  
  return (
    <LiveMetricCard
      label={formatSignalLabel(signal.signalDefinitionId)}
      value={typeof tracker.value === 'number' ? tracker.value : 0}
      unit={signal.effectiveUnit || ''}
      state={tracker.advisoryState}
      stats={tracker.stats}
      profile={tracker.profile}
      onSelect={() => onSelect(signal.signalDefinitionId)}
      isSelected={isSelected}
    />
  );
});
