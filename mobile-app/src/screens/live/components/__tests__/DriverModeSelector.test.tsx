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
  it('keeps all modes visible without rendering verbose decision-dimension chips', () => {
    const { getByText, getByTestId, queryByText, queryByTestId } = render(
      <DriverModeSelector selectedMode="PERFORMANCE" availableSignals={signals} onSelectMode={jest.fn()} />,
    );

    expect(getByTestId('driver-mode-essential')).toBeTruthy();
    expect(getByTestId('driver-mode-family')).toBeTruthy();
    expect(getByTestId('driver-mode-performance')).toBeTruthy();
    expect(getByTestId('driver-mode-off_road')).toBeTruthy();
    expect(getByTestId('driver-mode-diagnostic')).toBeTruthy();

    expect(getByText('1 READY')).toBeTruthy();
    expect(getByText(/2 PARTIAL/)).toBeTruthy();
    expect(queryByText('Engine state')).toBeNull();
    expect(queryByText('Thermal state')).toBeNull();
    expect(queryByText('Power demand')).toBeNull();
    expect(queryByText('UNKNOWN')).toBeNull();
    expect(queryByTestId('decision-dimension-airflow')).toBeNull();
    expect(queryByTestId('decision-dimension-electrical')).toBeNull();
  });

  it('renders no evidence summary when a mode has no reliable evidence', () => {
    const { queryByText } = render(
      <DriverModeSelector selectedMode="PERFORMANCE" availableSignals={[]} onSelectMode={jest.fn()} />,
    );

    expect(queryByText(/READY/)).toBeNull();
    expect(queryByText(/PARTIAL/)).toBeNull();
    expect(queryByText('UNKNOWN')).toBeNull();
  });

  it('emits the selected mode without changing acquisition state', () => {
    const onSelectMode = jest.fn();
    const { getByTestId } = render(
      <DriverModeSelector selectedMode="ESSENTIAL" availableSignals={signals} onSelectMode={onSelectMode} />,
    );

    fireEvent.press(getByTestId('driver-mode-off_road'));
    expect(onSelectMode).toHaveBeenCalledWith('OFF_ROAD');
  });

  it('cycles the compact selector for driving presentation', () => {
    const onSelectMode = jest.fn();
    const { getByTestId } = render(
      <DriverModeSelector selectedMode="ESSENTIAL" availableSignals={signals} onSelectMode={onSelectMode} compact />,
    );

    fireEvent.press(getByTestId('driver-mode-compact-selector'));
    expect(onSelectMode).toHaveBeenCalledWith('FAMILY');
  });
});
