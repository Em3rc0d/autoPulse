import { createCompatibilitySnapshot } from '../../diagnostics';
import { vehicleHealthFromCompatibility } from '../VehicleHealthFromCompatibility';

describe('VehicleHealthFromCompatibility', () => {
  it('maps confirmed, pending and permanent DTC evidence without inventing health state', () => {
    const snapshot = createCompatibilitySnapshot({
      connector: { transport: 'BLE', family: 'ELM327_COMPATIBLE' },
      connectorCapabilities: {
        requestKinds: ['OBD_STANDARD'],
        protocols: ['ISO_15765_CAN'],
        supportsAutomaticProtocolDiscovery: true,
        supportsRawDiagnosticRequests: true,
        supportsMultipleEcus: true,
      },
      connectorHealth: { connected: true, reliability: 'GOOD' },
      diagnosticServices: [
        {
          family: 'STORED_DTC', observed: true, sourceEcus: ['7E8'], diagnosticCodes: ['P0302'], evidence: [],
        },
        {
          family: 'PENDING_DTC', observed: true, sourceEcus: ['7E8'], diagnosticCodes: ['P0420'], evidence: [],
        },
        {
          family: 'PERMANENT_DTC', observed: false, sourceEcus: [], diagnosticCodes: ['P9999'], evidence: [],
        },
      ],
    });

    const health = vehicleHealthFromCompatibility(snapshot);

    expect(health.mil).toBe('UNKNOWN');
    expect(health.dtcs).toEqual([
      {
        code: 'P0302',
        status: 'CONFIRMED',
        description: 'Cylinder 2 misfire detected',
        ecu: '7E8',
      },
      {
        code: 'P0420',
        status: 'PENDING',
        description: undefined,
        ecu: '7E8',
      },
    ]);
  });
});
