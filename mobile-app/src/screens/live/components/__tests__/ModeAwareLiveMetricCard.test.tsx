import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DriverModeProvider, useDriverMode } from '../DriverModeContext';
import { LiveMetricCard } from '../LiveMetricCard';

const state = {
  quality: 'VALID' as const,
  advisory: 'NORMAL' as const,
  calibration: 'GENERIC_ONLY' as const,
  source: 'GENERIC_REFERENCE' as const,
  color: 'GREEN' as const,
  badgeText: 'NORMAL',
};

const stats = {
  validReadingCount: 1,
  validMinObserved: 900,
  validMaxObserved: 900,
};

const profile = {
  vehicleId: 'demo',
  signalId: 'ENGINE_RPM',
  sourceType: 'GENERIC_REFERENCE' as const,
  calibrationStatus: 'GENERIC_ONLY' as const,
  bands: [],
  hysteresisMs: 0,
  sustainDurationMs: 0,
};

function SwitchToDiagnostic() {
  const { setSelectedMode } = useDriverMode();
  return <button testID="diag" onClick={() => setSelectedMode('DIAGNOSTIC')} /> as any;
}

describe('mode-aware LiveMetricCard', () => {
  it('shows essential RPM and hides it when Diagnostic does not select it from the actual inventory', () => {
    const { getByText, getByTestId, queryByText } = render(
      <DriverModeProvider supportedPids={['010C']}>
        <SwitchToDiagnostic />
        <LiveMetricCard
          label="Engine RPM"
          value={900}
          unit="rpm"
          state={state}
          stats={stats}
          profile={profile}
        />
      </DriverModeProvider>,
    );

    expect(getByText('Engine RPM')).toBeTruthy();
    fireEvent.press(getByTestId('diag'));
    expect(queryByText('Engine RPM')).toBeNull();
  });
});
