import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
  validMinObserved: 42,
  validMaxObserved: 42,
};

const profile = {
  vehicleId: 'demo',
  signalId: 'VEHICLE_SPEED',
  sourceType: 'GENERIC_REFERENCE' as const,
  calibrationStatus: 'GENERIC_ONLY' as const,
  bands: [],
  hysteresisMs: 0,
  sustainDurationMs: 0,
};

function SwitchToPerformance() {
  const { setSelectedMode } = useDriverMode();
  return <TouchableOpacity testID="performance" onPress={() => setSelectedMode('PERFORMANCE')} />;
}

function ObservationProbe() {
  const { observations } = useDriverMode();
  return <Text testID="observed-at">{observations.VEHICLE_SPEED?.observedAt ?? 'none'}</Text>;
}

function SpeedHarness({ validReadingCount }: { validReadingCount: number }) {
  return (
    <DriverModeProvider supportedPids={['010D']}>
      <ObservationProbe />
      <LiveMetricCard
        label="Vehicle Speed"
        value={42}
        unit="km/h"
        state={state}
        stats={{ ...stats, validReadingCount }}
        profile={profile}
      />
    </DriverModeProvider>
  );
}

describe('mode-aware LiveMetricCard', () => {
  it('shows essential speed and hides it when Performance does not select it', () => {
    const { getByText, getByTestId, queryByText } = render(
      <DriverModeProvider supportedPids={['010D']}>
        <SwitchToPerformance />
        <LiveMetricCard
          label="Vehicle Speed"
          value={42}
          unit="km/h"
          state={state}
          stats={stats}
          profile={profile}
        />
      </DriverModeProvider>,
    );

    expect(getByText('Vehicle Speed')).toBeTruthy();
    fireEvent.press(getByTestId('performance'));
    expect(queryByText('Vehicle Speed')).toBeNull();
  });

  it('refreshes observation freshness when the ECU repeats the same valid value', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const rendered = render(<SpeedHarness validReadingCount={1} />);

    await waitFor(() => expect(rendered.getByTestId('observed-at').props.children).toBe(1_000));

    nowSpy.mockReturnValue(2_000);
    rendered.rerender(<SpeedHarness validReadingCount={2} />);

    await waitFor(() => expect(rendered.getByTestId('observed-at').props.children).toBe(2_000));
    nowSpy.mockRestore();
  });
});
