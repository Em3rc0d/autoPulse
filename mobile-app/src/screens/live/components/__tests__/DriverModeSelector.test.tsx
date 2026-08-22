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
  it('shows all five modes as decision coverage instead of a sensor checklist', () => {
    const { getByText, getByTestId, queryByText } = render(
      <DriverModeSelector selectedMode="PERFORMANCE" availableSignals={signals} onSelectMode={jest.fn()} />,
    );

    expect(getByTestId('driver-mode-essential')).toBeTruthy();
    expect(getByTestId('driver-mode-family')).toBeTruthy();
    expect(getByTestId('driver-mode-performance')).toBeTruthy();
    expect(getByTestId('driver-mode-off_road')).toBeTruthy();
    expect(getByTestId('driver-mode-diagnostic')).toBeTruthy();

    expect(getByText('ADAPTIVE')).toBeTruthy();
    expect(getByText('Engine state')).toBeTruthy();
    expect(getByText('Thermal state')).toBeTruthy();
    expect(getByText('Power demand')).toBeTruthy();
    expect(getByText('Air / boost')).toBeTruthy();
    expect(getByText('Electrical')).toBeTruthy();
    expect(queryByText(/Using 4 available signals/)).toBeNull();
    expect(queryByText(/preferred unavailable/)).toBeNull();
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
