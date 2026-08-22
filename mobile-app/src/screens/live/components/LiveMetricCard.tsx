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

  useEffect(() => {
    if (!driverMode || !signalId) return;
    driverMode.reportSignalQuality(signalId, toDriverQuality(props.state.quality));
  }, [driverMode, signalId, props.state.quality]);

  // Keep legacy/direct rendering behavior intact for tests and any screen that
  // intentionally renders a metric card outside the DriverModeProvider.
  if (!driverMode || !signalId) {
    return <BaseLiveMetricCard {...props} />;
  }

  const resolved = resolveDrivingMode(driverMode.selectedMode, driverMode.availableSignals);
  const selected = resolved.selectedSignals.some(signal => signal.signalId === signalId);

  // Adapter voltage is useful technical evidence but is not a preferred driver-mode
  // signal today. Keep it visible only in Diagnostic mode.
  const diagnosticAdapter = driverMode.selectedMode === 'DIAGNOSTIC' && signalId === 'ADAPTER_VOLTAGE';

  if (!selected && !diagnosticAdapter) {
    return null;
  }

  return <BaseLiveMetricCard {...props} />;
}
