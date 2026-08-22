import {
  characterizeDiagnosticServices,
  type DiagnosticConnector,
  type DiagnosticRequest,
  type DiagnosticResponse,
} from '..';

const makeResponse = (
  request: DiagnosticRequest,
  status: DiagnosticResponse['status'],
  sourceEcus: readonly string[] = [],
): DiagnosticResponse => ({
  request,
  status,
  rawText: status === 'SUCCESS' ? 'response' : undefined,
  decodedValues: [],
  sourceEcus,
  monitorStatus: request.payload === '0101' && status === 'SUCCESS'
    ? { milOn: true, confirmedDtcCount: 1 }
    : undefined,
  latencyMs: 10,
  errors: [],
});

const connector: DiagnosticConnector = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  identify: async () => ({ transport: 'USB', family: 'J2534' }),
  discoverCapabilities: async () => ({
    requestKinds: ['OBD_STANDARD', 'UDS', 'RAW_DIAGNOSTIC'],
    protocols: ['ISO_15765_CAN', 'UDS'],
    supportsAutomaticProtocolDiscovery: false,
    supportsRawDiagnosticRequests: true,
    supportsMultipleEcus: true,
  }),
  execute: async request => {
    if (request.payload === '0100') return makeResponse(request, 'SUCCESS', ['7E8', '7E9']);
    if (request.payload === '0101') return makeResponse(request, 'SUCCESS', ['7E8']);
    if (request.payload === '03') return makeResponse(request, 'SUCCESS', ['7E8']);
    if (request.payload === '07') return makeResponse(request, 'NO_DATA');
    if (request.payload === '0900') return makeResponse(request, 'SUCCESS', ['7E8']);
    if (request.payload === '0A') return makeResponse(request, 'NO_DATA');
    return makeResponse(request, 'UNSUPPORTED');
  },
  health: () => ({ connected: true, reliability: 'GOOD' }),
};

describe('DiagnosticServiceCharacterization', () => {
  it('records only services actually observed from successful responses', async () => {
    const result = await characterizeDiagnosticServices(connector);

    const currentData = result.services.find(item => item.family === 'CURRENT_DATA');
    const storedDtc = result.services.find(item => item.family === 'STORED_DTC');
    const pendingDtc = result.services.find(item => item.family === 'PENDING_DTC');
    const permanentDtc = result.services.find(item => item.family === 'PERMANENT_DTC');

    expect(currentData?.observed).toBe(true);
    expect(currentData?.sourceEcus).toEqual(['7E8', '7E9']);
    expect(currentData?.monitorStatus).toEqual({ milOn: true, confirmedDtcCount: 1 });
    expect(storedDtc?.observed).toBe(true);
    expect(pendingDtc?.observed).toBe(false);
    expect(permanentDtc?.observed).toBe(false);
  });

  it('does not equate advertised UDS capability with observed enhanced vehicle support', async () => {
    const result = await characterizeDiagnosticServices(connector);

    expect(result.enhancedDiagnosticsAdvertised).toBe(true);
    expect(result.enhancedDiagnosticsProbed).toBe(false);
    expect(result.observations.some(item => item.family === 'UDS_ENHANCED')).toBe(false);
  });

  it('never sends generic enhanced probes unless explicitly supplied', async () => {
    const payloads: string[] = [];
    const observingConnector: DiagnosticConnector = {
      ...connector,
      execute: async request => {
        payloads.push(request.payload);
        return makeResponse(request, 'NO_DATA');
      },
    };

    await characterizeDiagnosticServices(observingConnector);
    expect(payloads).toEqual(['0100', '0101', '03', '07', '0900', '0A']);
  });
});
