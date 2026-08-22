import React, { useEffect } from 'react';
import type {
  SignalAdvisoryProfile,
  SignalAdvisoryState,
  SignalSessionStats,
} from '../../../domain/telemetry/SignalAdvisory';
import { resolveDrivingMode, type SignalQuality } from '../../../domain/driver-intelligence';
import { LiveMetricCard as BaseLiveMetricCard } from './BaseLiveMetricCard';
import { useOptionalDriverMode } from './DriverModeContext';

interface Props {
  label: string;
  value: number | null | undefined;
  unit: string;
  state: SignalAdvisoryState;
  stats: SignalSessionStats;
  profile: SignalAdvisoryProfile;
  origin?: string;
  testID?: string;
}

const SIGNAL_BY_LABEL: Record<string, string> = {
  'Engine RPM': 'ENGINE_RPM',
  'Vehicle Speed': 'VEHICLE_SPEED',
  'Engine Coolant': 'ENGINE_COOLANT',
  'ECU Voltage': 'CONTROL_VOLTAGE',
  'Adapter Voltage': 'ADAPTER_VOLTAGE',
};

function toDriverQuality(quality: SignalAdvisoryState['quality']): SignalQuality {
  switch (quality) {
    case 'VALID': return 'VALID';
    case 'STALE': return 'STALE';
    case 'UNAVAILABLE': return 'UNAVAILABLE';
    case 'INVALID': return 'INVALID';
    case 'DEGRADED':
    case 'SUSPECT':
    default:
      return 'DEGRADED';
  }
}

export function LiveMetricCard(props: Props) {
  const driverMode = useOptionalDriverMode();
  const signalId = SIGNAL_BY_LABEL[props.label];
  const driverQuality = toDriverQuality(props.state.quality);

  useEffect(() => {
    if (!driverMode || !signalId) return;
    driverMode.reportSignalQuality(signalId, driverQuality);
    if (typeof props.value === 'number' && Number.isFinite(props.value)) {
      driverMode.reportSignalObservation({
        signalId,
        value: props.value,
        unit: props.unit,
        quality: driverQuality,
        origin: signalId === 'ADAPTER_VOLTAGE' ? 'DEVICE_SENSOR' : 'ECU_DIRECT',
        observedAt: Date.now(),
      });
    }
    // Deliberately keyed to real observation changes rather than the context
    // object, whose identity changes when observations are published.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalId, props.value, props.unit, driverQuality]);

  if (!driverMode || !signalId) {
    return <BaseLiveMetricCard {...props} />;
  }

  const resolved = resolveDrivingMode(driverMode.selectedMode, driverMode.availableSignals);
  const selected = resolved.selectedSignals.some(signal => signal.signalId === signalId);
  const diagnosticAdapter = driverMode.selectedMode === 'DIAGNOSTIC' && signalId === 'ADAPTER_VOLTAGE';

  if (!selected && !diagnosticAdapter) {
    return null;
  }

  return <BaseLiveMetricCard {...props} />;
}
