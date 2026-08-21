import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LiveSessionScreen from '../LiveSessionScreen';

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: {
      vehicleId: 'demo-vehicle',
      sessionId: 'test-session',
      adapterMode: 'VIRTUAL_PREVIEW',
    },
  }),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('@supersami/rn-foreground-service', () => ({
  start: jest.fn(),
  stop: jest.fn(),
  stopAll: jest.fn(),
  add_task: jest.fn(),
  remove_task: jest.fn(),
}));

jest.mock('../../../infrastructure/hooks/useVehicle', () => ({
  useVehicle: () => ({
    vehicle: { alias: 'Test Vehicle', make: 'Toyota', model: 'Corolla', year: 2020 },
    loading: false,
  }),
}));

jest.mock('../../../infrastructure/hooks/useLocalContext', () => ({
  useLocalContext: () => ({
    context: { defaultWorkspaceId: 'workspace-1' },
  }),
}));

jest.mock('../../../infrastructure/hooks/useProductDb', () => ({
  useProductDb: () => ({}),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../../application/config', () => ({
  AppConfig: {
    GENERIC_ADVISORY_PROFILES_ENABLED: true,
  },
}));

describe('LiveSessionScreen', () => {
  it('renders without ReferenceError and shows four metric cards', () => {
    const { getByText } = render(<LiveSessionScreen />);

    expect(getByText('Engine RPM')).toBeTruthy();
    expect(getByText('Vehicle Speed')).toBeTruthy();
    expect(getByText('Engine Coolant')).toBeTruthy();
    expect(getByText('Control Voltage')).toBeTruthy();
  });

  it('renders cards using two-column layout contract (width 48%)', () => {
    const { getByTestId } = render(<LiveSessionScreen />);

    const cardIds = [
      'live-metric-card-engine-rpm',
      'live-metric-card-vehicle-speed',
      'live-metric-card-engine-coolant',
      'live-metric-card-control-voltage'
    ];

    cardIds.forEach(id => {
      const card = getByTestId(id);
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle).toEqual(
        expect.objectContaining({ width: '48%' })
      );
    });
  });

  it.skip('shows advisory demo badges when explicitly enabled', () => {
    const { getAllByText } = render(<LiveSessionScreen />);
    const demoBadges = getAllByText('DEMO');
    expect(demoBadges.length).toBeGreaterThan(0);
  });

  it.skip('opening the modal of a card does not cause a crash', () => {
    const { getByTestId, queryByText } = render(<LiveSessionScreen />);
    const card = getByTestId('live-metric-card-engine-rpm');

    fireEvent.press(card);
    expect(queryByText('Límite exacto')).toBeTruthy();
  });
});
