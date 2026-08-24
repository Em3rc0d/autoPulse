import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import HistoryScreen from '../HistoryScreen';

const navigate = jest.fn();
const getRecentSessions = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactModule = require('react');
    ReactModule.useEffect(callback, [callback]);
  },
}));

jest.mock('../../infrastructure/hooks/useProductDb', () => ({
  useProductDb: () => ({})
}));

jest.mock('../../infrastructure/hooks/useLocalContext', () => ({
  useLocalContext: () => ({
    context: { defaultWorkspaceId: 'WS-1' },
    loading: false,
  })
}));

jest.mock('../../infrastructure/hooks/useVehicle', () => ({
  useVehicle: () => ({ vehicle: { alias: 'LOGAN' } })
}));

jest.mock('../../infrastructure/database/product/repositories/live-session.repository', () => ({
  LiveSessionRepository: jest.fn().mockImplementation(() => ({ getRecentSessions }))
}));

describe('HistoryScreen', () => {
  beforeEach(() => {
    navigate.mockReset();
    getRecentSessions.mockReset();
  });

  it('loads durable sessions and opens the reconstructed summary for a terminal session', async () => {
    getRecentSessions.mockResolvedValue([{
      id: 'session-12345678',
      vehicleId: 'vehicle-1',
      status: 'COMPLETED',
      startedAt: 1_000,
      endedAt: 61_000,
      createdAt: 900,
      totalBlocks: 12,
      totalReadings: 44,
      stopReason: 'USER_INITIATED',
      failureCode: null,
    }]);

    const screen = render(<HistoryScreen />);

    await waitFor(() => expect(screen.getByText('LOGAN')).toBeTruthy());
    expect(screen.getByText('COMPLETED')).toBeTruthy();
    expect(screen.getByText('1m 00s')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('44')).toBeTruthy();

    fireEvent.press(screen.getByTestId('history-session-session-12345678'));

    expect(navigate).toHaveBeenCalledWith('Live', {
      screen: 'SessionSummary',
      params: {
        vehicleId: 'vehicle-1',
        sessionId: 'session-12345678',
        isVirtual: false,
      },
    });
  });

  it('does not open a summary for a currently ACTIVE session', async () => {
    getRecentSessions.mockResolvedValue([{
      id: 'session-active',
      vehicleId: 'vehicle-1',
      status: 'ACTIVE',
      startedAt: 1_000,
      endedAt: null,
      createdAt: 900,
      totalBlocks: 2,
      totalReadings: 8,
      stopReason: null,
      failureCode: null,
    }]);

    const screen = render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('ACTIVE')).toBeTruthy());

    fireEvent.press(screen.getByTestId('history-session-session-active'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
