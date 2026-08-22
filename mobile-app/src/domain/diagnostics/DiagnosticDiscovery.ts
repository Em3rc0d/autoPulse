import type {
  DiagnosticAdapterFamily,
  DiagnosticConnector,
  DiagnosticConnectorIdentity,
  DiagnosticProtocol,
  DiagnosticRequest,
  DiagnosticResponse,
} from './DiagnosticConnector';

export interface DiagnosticDiscoveryEvidence {
  probe: string;
  status: DiagnosticResponse['status'];
  rawText?: string;
  latencyMs: number;
  sourceEcus: readonly string[];
}

export interface DiagnosticDiscoveryResult {
  declaredIdentity: DiagnosticConnectorIdentity;
  observedIdentity: DiagnosticConnectorIdentity;
  protocol: DiagnosticProtocol;
  sourceEcus: readonly string[];
  standardObdReachable: boolean;
  evidence: readonly DiagnosticDiscoveryEvidence[];
}

const request = (
  payload: string,
  kind: DiagnosticRequest['kind'],
  timeoutMs = 3000,
  expectedService?: string,
): DiagnosticRequest => ({
  id: `discover:${payload}:${Math.random().toString(36).slice(2)}`,
  payload,
  kind,
  timeoutMs,
  expectedService,
});

const normalizedText = (response?: DiagnosticResponse) => response?.rawText?.replace(/>/g, '').trim() ?? '';

export function classifyAdapterFamily(texts: readonly string[]): DiagnosticAdapterFamily {
  const text = texts.join(' ').toUpperCase();
  if (/STN\d+|OBDLINK/.test(text)) return 'STN_OBDLINK';
  if (/VGATE|VLINKER/.test(text)) return 'VGATE';
  if (/ELM327|ELM 327/.test(text)) return 'ELM327_COMPATIBLE';
  if (text.length > 0) return 'GENERIC_AT';
  return 'UNKNOWN';
}

export function classifyDiagnosticProtocol(texts: readonly string[]): DiagnosticProtocol {
  const text = texts.join(' ').toUpperCase();
  if (/ISO\s*15765|CAN\s*11\/500|CAN\s*29\/500|CAN\s*11\/250|CAN\s*29\/250|(^|\s)A?6($|\s)|(^|\s)A?7($|\s)|(^|\s)A?8($|\s)|(^|\s)A?9($|\s)/.test(text)) return 'ISO_15765_CAN';
  if (/ISO\s*14230|KWP/.test(text)) return 'ISO_14230_KWP';
  if (/ISO\s*9141/.test(text)) return 'ISO_9141_2';
  if (/J1850\s*PWM/.test(text)) return 'SAE_J1850_PWM';
  if (/J1850\s*VPW/.test(text)) return 'SAE_J1850_VPW';
  if (/UDS|ISO\s*14229/.test(text)) return 'UDS';
  return 'UNKNOWN';
}

/**
 * Evidence-first discovery that sits above any DiagnosticConnector.
 * Adapter-specific AT probes are used only when the connector advertises
 * ADAPTER_CONTROL support. Standard OBD reachability is tested independently,
 * so AutoPulse does not equate adapter branding with vehicle compatibility.
 */
export async function discoverDiagnosticEnvironment(
  connector: DiagnosticConnector,
): Promise<DiagnosticDiscoveryResult> {
  const declaredIdentity = await connector.identify();
  const capabilities = await connector.discoverCapabilities();
  const evidence: DiagnosticDiscoveryEvidence[] = [];
  const identityTexts: string[] = [];
  const protocolTexts: string[] = [];
  const ecuSet = new Set<string>();

  const run = async (req: DiagnosticRequest) => {
    const response = await connector.execute(req);
    evidence.push({
      probe: req.payload,
      status: response.status,
      rawText: response.rawText,
      latencyMs: response.latencyMs,
      sourceEcus: response.sourceEcus,
    });
    response.sourceEcus.forEach(ecu => ecuSet.add(ecu));
    return response;
  };

  if (capabilities.requestKinds.includes('ADAPTER_CONTROL')) {
    for (const probe of ['ATI', 'AT@1']) {
      const response = await run(request(probe, 'ADAPTER_CONTROL'));
      if (response.status === 'SUCCESS') identityTexts.push(normalizedText(response));
    }

    for (const probe of ['ATDP', 'ATDPN']) {
      const response = await run(request(probe, 'ADAPTER_CONTROL', 5000));
      if (response.status === 'SUCCESS') protocolTexts.push(normalizedText(response));
    }
  }

  const obdProbe = await run(request('0100', 'OBD_STANDARD', 8000, '41'));
  const standardObdReachable = obdProbe.status === 'SUCCESS';

  const observedFamily = classifyAdapterFamily(identityTexts);
  const observedProtocol = classifyDiagnosticProtocol(protocolTexts);

  return {
    declaredIdentity,
    observedIdentity: {
      ...declaredIdentity,
      family: observedFamily === 'UNKNOWN' ? declaredIdentity.family : observedFamily,
      model: identityTexts[1] || declaredIdentity.model,
      firmware: identityTexts[0] || declaredIdentity.firmware,
    },
    protocol: observedProtocol,
    sourceEcus: Array.from(ecuSet),
    standardObdReachable,
    evidence,
  };
}
