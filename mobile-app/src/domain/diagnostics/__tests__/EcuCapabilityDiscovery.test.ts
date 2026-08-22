import {
  discoverEcuCapabilities,
  type DiagnosticConnector,
  type DiagnosticRequest,
  type DiagnosticResponse,
} from '..';

const response = (
  request: DiagnosticRequest,
  sourceEcus: readonly string[],
  status: DiagnosticResponse['status'] = 'SUCCESS',
): DiagnosticResponse => ({
  request,
  status,
  decodedValues: [],
  sourceEcus,
  latencyMs: 12,
  errors: [],
});

describe('EcuCapabilityDiscovery', () => {
  it('attributes successful standard requests to the ECU addresses that actually responded', async () => {
    const connector: DiagnosticConnector = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      identify: async () => ({ transport: 'BLE', family: 'ELM327_COMPATIBLE' }),
      discoverCapabilities: async () => ({
        requestKinds: ['OBD_STANDARD'],
        protocols: ['ISO_15765_CAN'],
        supportsAutomaticProtocolDiscovery: true,
        supportsRawDiagnosticRequests: false,
        supportsMultipleEcus: true,
      }),
      execute: async request => {
        if (request.payload === '0100') return response(request, ['7E8', '7E9']);
        if (request.payload === '010C') return response(request, ['7E8']);
        if (request.payload === '03') return response(request, ['7E8', '7E9']);
        return response(request, [], 'NO_DATA');
      },
      health: () => ({ connected: true, reliability: 'GOOD' }),
    };

    const result = await discoverEcuCapabilities(connector, [
      { payload: '0100', expectedService: '41', expectedPid: '00' },
      { payload: '010C', expectedService: '41', expectedPid: '0C' },
      { payload: '03', expectedService: '43' },
    ]);

    expect(result.ecus.map(item => item.ecu)).toEqual(['7E8', '7E9']);
    expect(result.ecus[0].observedRequests).toEqual(['0100', '010C', '03']);
    expect(result.ecus[0].observedPids).toEqual(['00', '0C']);
    expect(result.ecus[1].observedRequests).toEqual(['0100', '03']);
  });

  it('keeps successful headerless responses unattributed instead of inventing an ECU address', async () => {
    const connector: DiagnosticConnector = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      identify: async () => ({ transport: 'BLUETOOTH_CLASSIC', family: 'GENERIC_AT' }),
      discoverCapabilities: async () => ({
        requestKinds: ['OBD_STANDARD'],
        protocols: ['UNKNOWN'],
        supportsAutomaticProtocolDiscovery: true,
        supportsRawDiagnosticRequests: false,
        supportsMultipleEcus: false,
      }),
      execute: async request => response(request, []),
      health: () => ({ connected: true, reliability: 'UNKNOWN' }),
    };

    const result = await discoverEcuCapabilities(connector, [
      { payload: '0105', expectedService: '41', expectedPid: '05' },
    ]);

    expect(result.ecus).toEqual([]);
    expect(result.unattributedObservations).toHaveLength(1);
    expect(result.unattributedObservations[0].ecu).toBe('UNKNOWN');
  });

  it('does not turn NO_DATA into capability evidence', async () => {
    const connector: DiagnosticConnector = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      identify: async () => ({ transport: 'USB', family: 'J2534' }),
      discoverCapabilities: async () => ({
        requestKinds: ['OBD_STANDARD'],
        protocols: ['UNKNOWN'],
        supportsAutomaticProtocolDiscovery: false,
        supportsRawDiagnosticRequests: true,
        supportsMultipleEcus: true,
      }),
      execute: async request => response(request, ['7E8'], 'NO_DATA'),
      health: () => ({ connected: true, reliability: 'GOOD' }),
    };

    const result = await discoverEcuCapabilities(connector, [
      { payload: '010C', expectedService: '41', expectedPid: '0C' },
    ]);

    expect(result.ecus).toEqual([]);
    expect(result.unattributedObservations).toEqual([]);
  });
});
