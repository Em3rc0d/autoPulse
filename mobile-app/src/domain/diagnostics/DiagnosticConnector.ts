export type DiagnosticTransport = 'BLUETOOTH_CLASSIC' | 'BLE' | 'WIFI' | 'USB' | 'UNKNOWN';

export type DiagnosticAdapterFamily =
  | 'ELM327_COMPATIBLE'
  | 'STN_OBDLINK'
  | 'VGATE'
  | 'GENERIC_AT'
  | 'J2534'
  | 'NATIVE_CAN'
  | 'UNKNOWN';

export type DiagnosticProtocol =
  | 'ISO_15765_CAN'
  | 'ISO_14230_KWP'
  | 'ISO_9141_2'
  | 'SAE_J1850_PWM'
  | 'SAE_J1850_VPW'
  | 'UDS'
  | 'UNKNOWN';

export type DiagnosticRequestKind =
  | 'ADAPTER_CONTROL'
  | 'OBD_STANDARD'
  | 'UDS'
  | 'RAW_DIAGNOSTIC'
  | 'VENDOR_SPECIFIC';

export type DiagnosticExecutionStatus =
  | 'SUCCESS'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'UNSUPPORTED'
  | 'INVALID_RESPONSE'
  | 'FAILED';

export interface DiagnosticConnectorIdentity {
  transport: DiagnosticTransport;
  family: DiagnosticAdapterFamily;
  model?: string;
  firmware?: string;
  hardwareId?: string;
}

export interface DiagnosticConnectorCapabilities {
  requestKinds: readonly DiagnosticRequestKind[];
  protocols: readonly DiagnosticProtocol[];
  supportsAutomaticProtocolDiscovery: boolean;
  supportsRawDiagnosticRequests: boolean;
  supportsMultipleEcus: boolean;
}

export interface DiagnosticConnectorHealth {
  connected: boolean;
  reliability: 'GOOD' | 'DEGRADED' | 'POOR' | 'UNKNOWN';
  lastLatencyMs?: number;
  lastError?: string;
}

export interface DiagnosticMonitorStatus {
  milOn: boolean;
  confirmedDtcCount: number;
}

export interface DiagnosticFreezeFrameTrigger {
  frameNumber: number;
  triggerDtc?: string;
  sourceEcu?: string;
}

export interface DiagnosticRequest {
  id: string;
  payload: string;
  kind: DiagnosticRequestKind;
  timeoutMs: number;
  expectedService?: string;
  expectedPid?: string;
}

export interface DiagnosticResponse {
  request: DiagnosticRequest;
  status: DiagnosticExecutionStatus;
  rawText?: string;
  decodedValues: readonly { type: string; value: unknown; unit?: string }[];
  sourceEcus: readonly string[];
  diagnosticCodes?: readonly string[];
  monitorStatus?: DiagnosticMonitorStatus;
  freezeFrameTrigger?: DiagnosticFreezeFrameTrigger;
  latencyMs: number;
  errors: readonly string[];
}

/**
 * Hardware-neutral diagnostic boundary for AutoPulse.
 * Driver Intelligence and startup assessment must depend on this contract,
 * never on ELM/BLE-specific implementation details.
 */
export interface DiagnosticConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  identify(): Promise<DiagnosticConnectorIdentity>;
  discoverCapabilities(): Promise<DiagnosticConnectorCapabilities>;
  execute(request: DiagnosticRequest): Promise<DiagnosticResponse>;
  health(): DiagnosticConnectorHealth;
}
