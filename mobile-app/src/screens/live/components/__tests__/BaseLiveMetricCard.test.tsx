import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { LiveMetricCard } from '../BaseLiveMetricCard';

const stats = {
  validReadingCount: 3,
  validMinObserved: 88,
  validMaxObserved: 95,
};

const profile = {
  vehicleId: 'test-vehicle',
  signalId: 'ENGINE_COOLANT',
  sourceType: 'GENERIC_REFERENCE' as const,
  calibrationStatus: 'GENERIC_ONLY' as const,
  bands: [],
  hysteresisMs: 0,
  sustainDurationMs: 0,
};

describe('BaseLiveMetricCard truth semantics', () => {
  it('does not present a stale numeric sample as the current value', () => {
    const { getByTestId, getByText } = render(
      <LiveMetricCard
        testID="coolant-card"
        label="Engine Coolant"
        value={92}
        unit="°C"
        state={{
          quality: 'STALE',
          advisory: 'UNKNOWN',
          calibration: 'GENERIC_ONLY',
          source: 'GENERIC_REFERENCE',
          color: 'GRAY',
          badgeText: 'STALE',
        }}
        stats={stats}
        profile={profile}
      />,
    );

    expect(getByTestId('coolant-card-value').props.children.join('')).toBe('-- ');
    expect(getByText('STALE')).toBeTruthy();
  });

  it('keeps the historical sample available only as an explicitly last-observed value', () => {
    const { getByTestId, getByText } = render(
      <LiveMetricCard
        testID="coolant-card"
        label="Engine Coolant"
        value={92}
        unit="°C"
        state={{
          quality: 'STALE',
          advisory: 'UNKNOWN',
          calibration: 'GENERIC_ONLY',
          source: 'GENERIC_REFERENCE',
          color: 'GRAY',
          badgeText: 'STALE',
        }}
        stats={stats}
        profile={profile}
      />,
    );

    fireEvent.press(getByTestId('coolant-card'));
    expect(getByText('Última lectura recibida')).toBeTruthy();
    expect(getByText('92 °C')).toBeTruthy();
    expect(getByText('Lectura desactualizada')).toBeTruthy();
  });
});
