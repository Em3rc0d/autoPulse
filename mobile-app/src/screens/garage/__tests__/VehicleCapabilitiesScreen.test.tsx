import React from 'react';
import { render } from '@testing-library/react-native';
import VehicleCapabilitiesScreen, {
  getCapabilityGroup,
  getCapabilityPresentation
} from '../VehicleCapabilitiesScreen';
import { useCapabilitySnapshot } from '../../../infrastructure/hooks/useCapabilitySnapshot';

jest.mock('../../../infrastructure/hooks/useVehicle', () => ({
  useVehicle: () => ({ vehicle: { alias: 'Test Vehicle' } })
}));

jest.mock('../../../infrastructure/hooks/useLocalContext', () => ({
  useLocalContext: () => ({ context: { defaultWorkspaceId: 'WS-1' } })
}));

jest.mock('../../../infrastructure/hooks/useCapabilitySnapshot', () => ({
  useCapabilitySnapshot: jest.fn()
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { vehicleId: 'V-1' } }),
  useNavigation: () => ({ goBack: jest.fn() })
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons'
}));

describe('VehicleCapabilitiesScreen', () => {
  it('renders technical PID, ECU provenance and fallback name when a definition is unavailable', () => {
    (useCapabilitySnapshot as jest.Mock).mockReturnValue({
      snapshot: {
        id: 'snap-1',
        discoveredAt: 123,
        protocolCode: 'ISO_15765_4_CAN_11_500',
        adapterInstanceId: 'adapter-1'
      },
      loading: false,
      parameters: [
        {
          id: 'param-1',
          snapshotId: 'snap-1',
          service: 1,
          parameterIdentifier: 0x0c,
          ecuAddress: 0x7e8,
          supportState: 'SUPPORTED',
          testedAt: 123,
          technicalName: null
        }
      ]
    });

    const { getByText, queryByText } = render(<VehicleCapabilitiesScreen />);

    expect(getByText('Standard OBD signal')).toBeTruthy();
    expect(getByText('Mode 01 PID 0C (ECU 7E8)')).toBeTruthy();
    expect(getByText('Available')).toBeTruthy();
    expect(getByText('The vehicle reports that this signal is available.')).toBeTruthy();

    // Missing catalog metadata must not be confused with vehicle non-support.
    expect(queryByText('Unavailable')).toBeFalsy();

    expect(useCapabilitySnapshot).toHaveBeenCalledWith('WS-1', 'V-1');
  });

  it('keeps advertised, observed, pending and unavailable evidence distinct', () => {
    expect(getCapabilityPresentation({ supportState: 'SUPPORTED' }).label).toBe('Available');
    expect(getCapabilityPresentation({ supportState: 'DIRECTLY_OBSERVED' }).label).toBe('Observed');
    expect(getCapabilityPresentation({ supportState: 'PROBE_PENDING' }).label).toBe('Not observed yet');
    expect(getCapabilityPresentation({ supportState: 'NOT_AVAILABLE' }).label).toBe('Unavailable');
  });

  it('groups catalog signals into non-technical sections', () => {
    expect(getCapabilityGroup('010C')).toBe('Engine');
    expect(getCapabilityGroup('0105')).toBe('Temperatures');
    expect(getCapabilityGroup('010D')).toBe('Movement');
    expect(getCapabilityGroup('0142')).toBe('Electrical');
  });
});
