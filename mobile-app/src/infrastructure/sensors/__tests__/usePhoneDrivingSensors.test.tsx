import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { usePhoneDrivingSensors } from '../usePhoneDrivingSensors';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

function SensorHarness() {
  usePhoneDrivingSensors(true);
  return null;
}

describe('usePhoneDrivingSensors Live isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('never launches a location permission prompt while Off-Road is enabled in Live', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    render(<SensorHarness />);

    await waitFor(() => {
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('starts passive location telemetry when permission was already granted', async () => {
    const remove = jest.fn();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove });

    const rendered = render(<SensorHarness />);

    await waitFor(() => {
      expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
