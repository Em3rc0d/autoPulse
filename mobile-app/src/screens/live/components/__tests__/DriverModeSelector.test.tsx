import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DriverModeSelector } from '../DriverModeSelector';

const signals = [
  { signalId: 'ENGINE_RPM', origin: 'ECU_DIRECT' as const, quality: 'VALID' as const },
  { signalId: 'ENGINE_COOLANT', origin: 'ECU_DIRECT' as const, quality: 'VALID' as const },
  { signalId: 'ENGINE_LOAD', origin: 'ECU_DIRECT' as const, quality: 'VALID' as const },
  { signalId: 'THROTTLE_POSITION', origin: 'ECU_DIRECT' as const, quality: 'DEGRADED' as const },
];

describe('DriverModeSelector', () => {
  it('shows all five driver modes and explains adaptive degradation', () => {
    const { getByText, getByTestId } = render(
      <DriverModeSelector selectedMode="PERFORMANCE" availableSignals={signals} onSelectMode={jest.fn()} />,
    );

    expect(getByTestId('driver-mode-essential')).toBeTruthy();
    expect(getByTestId('driver-mode-family')).toBeTruthy();
    expect(getByTestId('driver-mode-performance')).toBeTruthy();
    expect(getByTestId('driver-mode-off_road')).toBeTruthy();
    expect(getByTestId('driver-mode-diagnostic')).toBeTruthy();
    expect(getByText('ADAPTIVE')).toBeTruthy();
    expect(getByText(/Using 4 available signals/)).toBeTruthy();
  });

  it('emits the selected mode without changing acquisition state', () => {
    const onSelectMode = jest.fn();
    const { getByTestId } = render(
      <DriverModeSelector selectedMode="ESSENTIAL" availableSignals={signals} onSelectMode={onSelectMode} />,
    );

    fireEvent.press(getByTestId('driver-mode-off_road'));
    expect(onSelectMode).toHaveBeenCalledWith('OFF_ROAD');
  });
});
