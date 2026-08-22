import { characterizeRuntimeCompatibility } from '../RuntimeCompatibilityCharacterization';
import type {
  DiagnosticConnector,
  DiagnosticRequest,
  DiagnosticResponse,
} from '../../../domain/diagnostics';

const responseMap: Record<string, Partial<DiagnosticResponse>> = {
  ATI: { status: 'SUCCESS', rawText: 'STN2230 v5.7.1', sourceEcus: [], latencyMs: 5 },
  'AT@1': { status: 'SUCCESS', rawText: 'OBDLink MX+', sourceEcus: [], latencyMs: 5 },
  ATDP: { status: 'SUCCESS', rawText: 'ISO 15765-4 (CAN 11/500)', sourceEcus: [], latencyMs: 5 },
  ATDPN: { status: 'SUCCESS', rawText: 'A6', sourceEcus: [], latencyMs: 5 },
  '0100': { status: 'SUCCESS', rawText: '7E8 06 41 00 BE 3F A8 13', sourceEcus: ['7E8'], latencyMs: 12 },
  '010C': { status: 'SUCCESS', rawText: '7E8 04 41 0C 1A F8', sourceEcus: ['7E8'], latencyMs: 12 },
  '010D': { status: 'SUCCESS', rawText: '7E8 03 41 0D 00', sourceEcus: ['7E8'], latencyMs: 12 },
  '0105': { status: 'SUCCESS', rawText: '7E8 03 41 05 68', sourceEcus: ['7E8'], latencyMs: 12 },
  '0142': { status: 'NO_DATA', sourceEcus: [], latencyMs: 12 },
  '03': { status: 'SUCCESS', rawText: '7E8 02 43 00', sourceEcus: ['7E8'], latencyMs: 15 },
  '07': { status: 'NO_DATA', sourceEcus: [], latencyMs: 15 },
  '0900': { status: 'SUCCESS', rawText: '7E8 06 49 00 55 40 00 00', sourceEcus: ['7E8'], latencyMs: 18 },
  '0902': { status: 'SUCCESS', rawText: '7E8 10 14 49 02 01', sourceEcus: ['7E8'], latencyMs: 18 },
  '0A': { status: 'NO_DATA', sourceEcus: [], latencyMs: 15 },
};

const connector: DiagnosticConnector = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  identify: async () => ({ transport: 'WIFI', family: 'UNKNOWN' }),
  discoverCapabilities: async () => ({
    requestKinds: ['ADAPTER_CONTROL', 'OBD_STANDARD', 'UDS'],
    protocols: ['UNKNOWN'],
    supportsAutomaticProtocolDiscovery: true,
    supportsRawDiagnosticRequests: true,
    supportsMultipleEcus: true,
  }),
  execute: async (request: DiagnosticRequest) => {
    const partial = responseMap[request.payload] ?? { status: 'NO_DATA' as const };
    return {
      request,
      status: partial.status ?? 'NO_DATA',
      rawText: partial.rawText,
      decodedValues: partial.decodedValues ?? [],
      sourceEcus: partial.sourceEcus ?? [],
      latencyMs: partial.latencyMs ?? 1,
      errors: partial.errors ?? [],
    };
  },
  health: () => ({ connected: true, reliability: 'GOOD', lastLatencyMs: 18 }),
};

describe('characterizeRuntimeCompatibility', () => {
  it('combines connector, protocol, ECU and service evidence without inventing enhanced support', async () => {
    const snapshot = await characterizeRuntimeCompatibility({
      connector,
      vehicle: { make: 'Renault', model: 'Logan' },
      capturedAt: 123,
    });

    expect(snapshot.capturedAt).toBe(123);
    expect(snapshot.connector.family).toBe('STN_OBDLINK');
    expect(snapshot.protocol).toBe('ISO_15765_CAN');
    expect(snapshot.discoveredEcus).toContain('7E8');
    expect(snapshot.ecuCapabilities.find(item => item.ecu === '7E8')?.observedPids).toContain('0C');
    expect(snapshot.diagnosticServices.find(item => item.family === 'STORED_DTC')?.observed).toBe(true);
    expect(snapshot.enhancedDiagnosticsAdvertised).toBe(true);
    expect(snapshot.enhancedDiagnosticsProbed).toBe(false);
  });
});
