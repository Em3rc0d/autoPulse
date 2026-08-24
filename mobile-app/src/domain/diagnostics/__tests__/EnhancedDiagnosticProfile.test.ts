import {
  runEnhancedDiagnosticProfile,
  type DiagnosticConnector,
  type DiagnosticRequest,
  type EnhancedDiagnosticProfile,
} from '..';

const profile: EnhancedDiagnosticProfile = {
  id: 'known-readonly-profile',
  version: 1,
  match: { make: 'Test', model: 'Vehicle', moduleRole: 'KNOWN_MODULE' },
  probes: [
    {
      id: 'readonly-uds',
      kind: 'UDS',
      payload: '22F190',
      expectedService: '62',
      access: 'READ_ONLY',
    },
  ],
};

const makeConnector = (requestKinds: readonly any[]): { connector: DiagnosticConnector; payloads: string[] } => {
  const payloads: string[] = [];
  const connector: DiagnosticConnector = {
    connect: async () => undefined,
    disconnect: async () => undefined,
    identify: async () => ({ transport: 'USB', family: 'J2534' }),
    discoverCapabilities: async () => ({
      requestKinds,
      protocols: ['UDS'],
      supportsAutomaticProtocolDiscovery: false,
      supportsRawDiagnosticRequests: true,
      supportsMultipleEcus: true,
    }),
    execute: async (request: DiagnosticRequest) => {
      payloads.push(request.payload);
      return {
        request,
        status: 'SUCCESS',
        rawText: '62F190...',
        decodedValues: [],
        sourceEcus: ['7E8'],
        latencyMs: 12,
        errors: [],
      };
    },
    health: () => ({ connected: true, reliability: 'GOOD' }),
  };
  return { connector, payloads };
};

describe('EnhancedDiagnosticProfile', () => {
  it('executes only probes explicitly authorized by a read-only profile', async () => {
    const { connector, payloads } = makeConnector(['UDS']);
    const result = await runEnhancedDiagnosticProfile(connector, profile);

    expect(result.executed).toBe(true);
    expect(payloads).toEqual(['22F190']);
    expect(result.observations[0]).toMatchObject({
      profileId: 'known-readonly-profile',
      probeId: 'readonly-uds',
      status: 'SUCCESS',
      sourceEcus: ['7E8'],
    });
  });

  it('does not send enhanced requests when connector support is absent', async () => {
    const { connector, payloads } = makeConnector(['OBD_STANDARD']);
    const result = await runEnhancedDiagnosticProfile(connector, profile);

    expect(result.executed).toBe(false);
    expect(result.reason).toBe('NO_SUPPORTED_REQUEST_KIND');
    expect(payloads).toEqual([]);
  });

  it('has no generic enhanced fallback when a profile has no probes', async () => {
    const { connector, payloads } = makeConnector(['UDS', 'VENDOR_SPECIFIC']);
    const result = await runEnhancedDiagnosticProfile(connector, {
      ...profile,
      id: 'empty-profile',
      probes: [],
    });

    expect(result.executed).toBe(false);
    expect(result.reason).toBe('NO_PROBES');
    expect(payloads).toEqual([]);
  });
});
