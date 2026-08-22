import {
  classifyAdapterFamily,
  classifyDiagnosticProtocol,
  discoverDiagnosticEnvironment,
  type DiagnosticConnector,
  type DiagnosticRequest,
  type DiagnosticResponse,
} from '..';

const responseFor = (request: DiagnosticRequest): DiagnosticResponse => {
  const map: Record<string, Partial<DiagnosticResponse>> = {
    ATI: { status: 'SUCCESS', rawText: 'STN2230 v5.7.1', latencyMs: 15 },
    'AT@1': { status: 'SUCCESS', rawText: 'OBDLink MX+', latencyMs: 12 },
    ATDP: { status: 'SUCCESS', rawText: 'ISO 15765-4 (CAN 11/500)', latencyMs: 10 },
    ATDPN: { status: 'SUCCESS', rawText: 'A6', latencyMs: 10 },
    '0100': { status: 'SUCCESS', rawText: '7E8 06 41 00 BE 3F A8 13', latencyMs: 22, sourceEcus: ['7E8'] },
  };
  const override = map[request.payload] ?? {};
  return {
    request,
    status: override.status ?? 'NO_DATA',
    rawText: override.rawText,
    decodedValues: [],
    sourceEcus: override.sourceEcus ?? [],
    latencyMs: override.latencyMs ?? 0,
    errors: [],
  };
};

const connector: DiagnosticConnector = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  identify: async () => ({ transport: 'WIFI', family: 'UNKNOWN' }),
  discoverCapabilities: async () => ({
    requestKinds: ['ADAPTER_CONTROL', 'OBD_STANDARD'],
    protocols: ['UNKNOWN'],
    supportsAutomaticProtocolDiscovery: true,
    supportsRawDiagnosticRequests: false,
    supportsMultipleEcus: true,
  }),
  execute: async request => responseFor(request),
  health: () => ({ connected: true, reliability: 'GOOD' }),
};

describe('DiagnosticDiscovery', () => {
  it('classifies common adapter identity evidence without trusting transport', () => {
    expect(classifyAdapterFamily(['STN2230', 'OBDLink MX+'])).toBe('STN_OBDLINK');
    expect(classifyAdapterFamily(['ELM327 v1.5'])).toBe('ELM327_COMPATIBLE');
    expect(classifyAdapterFamily(['vLinker MC+'])).toBe('VGATE');
    expect(classifyAdapterFamily([])).toBe('UNKNOWN');
  });

  it('classifies protocol evidence conservatively', () => {
    expect(classifyDiagnosticProtocol(['ISO 15765-4 (CAN 11/500)'])).toBe('ISO_15765_CAN');
    expect(classifyDiagnosticProtocol(['ISO 9141-2'])).toBe('ISO_9141_2');
    expect(classifyDiagnosticProtocol(['mystery protocol'])).toBe('UNKNOWN');
  });

  it('discovers observed family, protocol, ECU and standard OBD reachability from evidence', async () => {
    const result = await discoverDiagnosticEnvironment(connector);

    expect(result.declaredIdentity).toEqual({ transport: 'WIFI', family: 'UNKNOWN' });
    expect(result.observedIdentity.family).toBe('STN_OBDLINK');
    expect(result.protocol).toBe('ISO_15765_CAN');
    expect(result.standardObdReachable).toBe(true);
    expect(result.sourceEcus).toEqual(['7E8']);
    expect(result.evidence.map(item => item.probe)).toEqual(['ATI', 'AT@1', 'ATDP', 'ATDPN', '0100']);
  });

  it('does not send AT probes when the connector does not advertise adapter control', async () => {
    const payloads: string[] = [];
    const rawConnector: DiagnosticConnector = {
      ...connector,
      identify: async () => ({ transport: 'USB', family: 'J2534' }),
      discoverCapabilities: async () => ({
        requestKinds: ['OBD_STANDARD', 'UDS', 'RAW_DIAGNOSTIC'],
        protocols: ['UNKNOWN'],
        supportsAutomaticProtocolDiscovery: false,
        supportsRawDiagnosticRequests: true,
        supportsMultipleEcus: true,
      }),
      execute: async request => {
        payloads.push(request.payload);
        return {
          request,
          status: 'NO_DATA',
          decodedValues: [],
          sourceEcus: [],
          latencyMs: 1,
          errors: [],
        };
      },
    };

    const result = await discoverDiagnosticEnvironment(rawConnector);
    expect(payloads).toEqual(['0100']);
    expect(result.observedIdentity.family).toBe('J2534');
    expect(result.protocol).toBe('UNKNOWN');
    expect(result.standardObdReachable).toBe(false);
  });
});
