import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DriverModeProvider, useDriverMode } from '../DriverModeContext';

function Probe() {
  const { selectedMode, setSelectedMode, availableSignals, reportSignalQuality } = useDriverMode();
  const rpm = availableSignals.find(signal => signal.signalId === 'ENGINE_RPM');

  return (
    <View>
      <Text testID="mode">{selectedMode}</Text>
      <Text testID="rpm-quality">{rpm?.quality || 'NONE'}</Text>
      <TouchableOpacity testID="performance" onPress={() => setSelectedMode('PERFORMANCE')} />
      <TouchableOpacity testID="observe-rpm" onPress={() => reportSignalQuality('ENGINE_RPM', 'VALID')} />
    </View>
  );
}

describe('DriverModeContext', () => {
  it('builds live inventory from supported PIDs and upgrades quality from observations', () => {
    const { getByTestId } = render(
      <DriverModeProvider supportedPids={['010C', '0105']}>
        <Probe />
      </DriverModeProvider>,
    );

    expect(getByTestId('mode').props.children).toBe('ESSENTIAL');
    expect(getByTestId('rpm-quality').props.children).toBe('DEGRADED');

    fireEvent.press(getByTestId('observe-rpm'));
    expect(getByTestId('rpm-quality').props.children).toBe('VALID');

    fireEvent.press(getByTestId('performance'));
    expect(getByTestId('mode').props.children).toBe('PERFORMANCE');
  });
});
