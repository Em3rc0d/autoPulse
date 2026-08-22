import {
  createCompatibilitySnapshot,
  type DiagnosticConnector,
  type DiagnosticRequest,
} from '..';

class FakeConnector implements DiagnosticConnector {
  async connect() {}
  async disconnect() {}
  async identify() {
    return { transport: 'WIFI' as const, family: 'STN_OBDLINK' as const, model: 'Fake STN' };
  }
  async discoverCapabilities() {
    return {
      requestKinds: ['OBD_STANDARD', 'UDS'] as const,
      protocols: ['ISO_15765_CAN', 'UDS'] as const,
      supportsAutomaticProtocolDiscovery: true,
      supportsRawDiagnosticRequests: true,
      supportsMultipleEcus: true,
    };
  }
  async execute(request: DiagnosticRequest) {
    return {
      request,
      status: 'SUCCESS' as const,
      rawText: '410C1AF8',
      decodedValues: [{ type: 'ENGINE_RPM', value: 1726, unit: 'rpm' }],
      sourceEcus: ['7E8'],
      latencyMs: 24,
      errors: [],
    };
  }
  health() {
    return { connected: true, reliability: 'GOOD' as const, lastLatencyMs: 24 };
  }
}

describe('connector-agnostic diagnostics', () => {
  it('allows non-ELM transports to satisfy the same connector contract', async () => {
    const connector = new FakeConnector();
    const response = await connector.execute({
      id: 'rpm', payload: '010C', kind: 'OBD_STANDARD', timeoutMs: 1_000,
    });

    expect((await connector.identify()).transport).toBe('WIFI');
    expect(response.decodedValues[0].type).toBe('ENGINE_RPM');
  });

  it('records connector x vehicle evidence without inventing protocol or ECU support', () => {
    const snapshot = createCompatibilitySnapshot({
      capturedAt: 100,
      connector: { transport: 'BLE', family: 'ELM327_COMPATIBLE' },
      connectorCapabilities: {
        requestKinds: ['OBD_STANDARD'],
        protocols: ['UNKNOWN'],
        supportsAutomaticProtocolDiscovery: true,
        supportsRawDiagnosticRequests: true,
        supportsMultipleEcus: false,
      },
      connectorHealth: { connected: true, reliability: 'DEGRADED' },
      vehicle: { make: 'Renault', model: 'Logan' },
      discoveredEcus: [],
    });

    expect(snapshot.protocol).toBe('UNKNOWN');
    expect(snapshot.discoveredEcus).toEqual([]);
    expect(snapshot.ecuCapabilities).toEqual([]);
    expect(snapshot.connector.family).toBe('ELM327_COMPATIBLE');
  });

  it('derives discovered ECU addresses from persisted ECU capability evidence', () => {
    const snapshot = createCompatibilitySnapshot({
      capturedAt: 200,
      connector: { transport: 'WIFI', family: 'STN_OBDLINK' },
      connectorCapabilities: {
        requestKinds: ['OBD_STANDARD'],
        protocols: ['ISO_15765_CAN'],
        supportsAutomaticProtocolDiscovery: true,
        supportsRawDiagnosticRequests: true,
        supportsMultipleEcus: true,
      },
      connectorHealth: { connected: true, reliability: 'GOOD' },
      protocol: 'ISO_15765_CAN',
      ecuCapabilities: [{
        ecu: '7E8',
        observedRequests: ['0100', '010C'],
        observedServices: ['41'],
        observedPids: ['00', '0C'],
        observations: [],
      }],
    });

    expect(snapshot.discoveredEcus).toEqual(['7E8']);
    expect(snapshot.ecuCapabilities[0].observedPids).toEqual(['00', '0C']);
  });
});
