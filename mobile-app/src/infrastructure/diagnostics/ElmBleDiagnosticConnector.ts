import type {
  DiagnosticConnector,
  DiagnosticConnectorCapabilities,
  DiagnosticConnectorHealth,
  DiagnosticConnectorIdentity,
  DiagnosticExecutionStatus,
  DiagnosticRequest,
  DiagnosticRequestKind,
  DiagnosticResponse,
} from '../../domain/diagnostics/DiagnosticConnector';
import { RealObdController } from '../ble/real/RealObdController';
import type { CommandFamily, CommandResultStatus } from '../ble/real/pipeline/types';

const familyFor = (kind: DiagnosticRequestKind): CommandFamily => {
  switch (kind) {
    case 'ADAPTER_CONTROL': return 'ELM_AT';
    case 'OBD_STANDARD': return 'RAW_DIAGNOSTIC';
    case 'UDS': return 'RAW_DIAGNOSTIC';
    case 'VENDOR_SPECIFIC': return 'VENDOR_SPECIFIC';
    case 'RAW_DIAGNOSTIC': return 'RAW_DIAGNOSTIC';
  }
};

const statusFor = (status: CommandResultStatus): DiagnosticExecutionStatus => {
  switch (status) {
    case 'SUCCESS_DECODED':
    case 'SUCCESS_RAW':
    case 'PARTIAL':
      return 'SUCCESS';
    case 'NO_DATA': return 'NO_DATA';
    case 'TIMEOUT': return 'TIMEOUT';
    case 'DISCONNECTED': return 'DISCONNECTED';
    case 'INVALID_RESPONSE': return 'INVALID_RESPONSE';
    case 'ELM_ERROR':
    case 'CANCELLED':
    case 'WRITE_FAILED':
      return 'FAILED';
  }
};

export interface ElmBleDiagnosticConnectorOptions {
  identity?: Partial<DiagnosticConnectorIdentity>;
}

/**
 * Compatibility adapter around the currently proven BLE + ELM pipeline.
 * This class is intentionally thin: it preserves RealObdController behavior
 * while exposing the hardware-neutral DiagnosticConnector contract.
 */
export class ElmBleDiagnosticConnector implements DiagnosticConnector {
  private readonly controller: RealObdController;
  private readonly identityValue: DiagnosticConnectorIdentity;
  private lastHealth: DiagnosticConnectorHealth;

  constructor(controller: RealObdController, options: ElmBleDiagnosticConnectorOptions = {}) {
    this.controller = controller;
    this.identityValue = {
      transport: 'BLE',
      family: 'ELM327_COMPATIBLE',
      ...options.identity,
    };
    this.lastHealth = {
      connected: controller.isConnected,
      reliability: 'UNKNOWN',
    };
  }

  async connect(): Promise<void> {
    if (!this.controller.isConnected) {
      throw new Error('Current BLE controller cannot reconnect in place; create it from an active connection.');
    }
    this.lastHealth = { ...this.lastHealth, connected: true };
  }

  async disconnect(): Promise<void> {
    this.controller.disconnect();
    this.lastHealth = { ...this.lastHealth, connected: false };
  }

  async identify(): Promise<DiagnosticConnectorIdentity> {
    return this.identityValue;
  }

  async discoverCapabilities(): Promise<DiagnosticConnectorCapabilities> {
    return {
      requestKinds: ['ADAPTER_CONTROL', 'OBD_STANDARD', 'RAW_DIAGNOSTIC', 'VENDOR_SPECIFIC'],
      protocols: ['UNKNOWN'],
      supportsAutomaticProtocolDiscovery: true,
      supportsRawDiagnosticRequests: true,
      supportsMultipleEcus: true,
    };
  }

  async execute(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    const result = await this.controller.executeCommand({
      id: request.id,
      command: request.payload,
      family: familyFor(request.kind),
      expectedService: request.expectedService,
      expectedPid: request.expectedPid,
      timeoutMs: request.timeoutMs,
    });

    const sourceEcus = Array.from(new Set(
      result.obdFrames
        .map(frame => frame.sourceAddress)
        .filter((source): source is string => Boolean(source)),
    ));

    const status = statusFor(result.status);
    this.lastHealth = {
      connected: status !== 'DISCONNECTED' && this.controller.isConnected,
      reliability: status === 'SUCCESS' || status === 'NO_DATA'
        ? 'GOOD'
        : status === 'TIMEOUT' || status === 'INVALID_RESPONSE'
          ? 'DEGRADED'
          : 'POOR',
      lastLatencyMs: result.latencyMs,
      lastError: result.errors[0],
    };

    return {
      request,
      status,
      rawText: result.rawResponse?.accumulatedText,
      decodedValues: result.decodedValues,
      sourceEcus,
      latencyMs: result.latencyMs,
      errors: result.errors,
    };
  }

  health(): DiagnosticConnectorHealth {
    return { ...this.lastHealth, connected: this.controller.isConnected };
  }
}
