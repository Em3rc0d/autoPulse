import React from 'react';
import { render } from '@testing-library/react-native';
import VehicleCheckReportScreen from '../VehicleCheckReportScreen';

const goBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack }),
  useRoute: () => ({ params: { sessionId: 'session-1', vehicleId: 'vehicle-1' } }),
}));

jest.mock('../../../infrastructure/hooks/useProductDb', () => ({
  useProductDb: () => ({}),
}));

jest.mock('../../../infrastructure/hooks/useLocalContext', () => ({
  useLocalContext: () => ({
    context: { defaultWorkspaceId: 'workspace-1' },
    loading: false,
  }),
}));

jest.mock('../../../infrastructure/hooks/useVehicle', () => ({
  useVehicle: () => ({ vehicle: { alias: 'Logan' } }),
}));

jest.mock('../../../infrastructure/hooks/useSessionSummary', () => ({
  useSessionSummary: () => ({
    summary: null,
    loading: false,
    error: new Error("Property 'Buffer' doesn't exist"),
  }),
}));

describe('VehicleCheckReportScreen failure containment', () => {
  it('surfaces reconstruction errors instead of masking them behind the loading state', () => {
    const screen = render(<VehicleCheckReportScreen />);

    expect(screen.getByText('Check unavailable')).toBeTruthy();
    expect(screen.getByText("Property 'Buffer' doesn't exist")).toBeTruthy();
    expect(screen.queryByText('Reconstructing and sealing evidence…')).toBeNull();
  });
});
