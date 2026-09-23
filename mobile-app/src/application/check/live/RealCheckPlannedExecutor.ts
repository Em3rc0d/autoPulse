import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import { RealObdController } from '../../../infrastructure/ble/real/RealObdController';
import type { CommandFamily, CommandRequest } from '../../../infrastructure/ble/real/pipeline/types';
import type { PlannedDiagnosticExecutionReceipt, PlannedDiagnosticExecutor } from '../replay/DiagnosticExecutionPort';
import type { PlannedDiagnosticRequest } from '../planner/DiagnosticScanPlanner';
import { adaptRealCommandResultToReceipt } from './RealCheckEnvelopeAdapter';

export class CheckPilotCancellationToken {
  private cancelled = false;
  cancel(): void { this.cancelled = true; }
  get isCancelled(): boolean { return this.cancelled; }
}

export type CheckPhysicalReceiptObserver = (
  request: PlannedDiagnosticRequest,
  receipt: PlannedDiagnosticExecutionReceipt,
) => void;

function familyForAuthorizedService(service: string): CommandFamily {
  switch (service.toUpperCase()) {
    case '01': return 'OBD_MODE_01';
    case '03': return 'OBD_MODE_03';
    case '07': return 'OBD_MODE_07';
    case '0A': return 'OBD_MODE_0A';
    default:
      throw new Error(`CHECK_EXECUTOR_SERVICE_NOT_ALLOWLISTED:${service}`);
  }
}

function commandForPlannedRequest(request: PlannedDiagnosticRequest): string {
  if (request.subfunction) {
    throw new Error(`CHECK_EXECUTOR_SUBFUNCTION_NOT_PROMOTED:${request.semanticId}`);
  }
  const command = `${request.service}${request.pid ?? ''}`.toUpperCase();
  if (!/^[0-9A-F]{2}(?:[0-9A-F]{2})?$/.test(command)) {
    throw new Error(`CHECK_EXECUTOR_INVALID_DESCRIPTOR_COMMAND:${request.semanticId}`);
  }
  return command;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Physical execution adapter for the Check pilot.
 *
 * There is intentionally no free-form execute API. The only input is a request
 * already emitted by DiagnosticScanPlanner from the READ_ONLY_PROVEN registry.
 * The optional observer receives immutable normalized receipts for pilot
 * provenance/debug evidence; it cannot influence execution.
 */
export class RealCheckPlannedExecutor implements PlannedDiagnosticExecutor {
  private lastFinishedWallClock: number | undefined;

  constructor(
    private readonly controller: RealObdController,
    private readonly protocol: DiagnosticProtocol,
    private readonly provenance: string,
    private readonly requestTimeoutMs: number,
    private readonly minInterCommandDelayMs: number,
    private readonly cancellation: CheckPilotCancellationToken,
    private readonly onReceipt?: CheckPhysicalReceiptObserver,
  ) {}

  async executeCommand(
    request: PlannedDiagnosticRequest,
    attemptIndex: number,
    startedAt: number,
  ): Promise<PlannedDiagnosticExecutionReceipt> {
    if (this.cancellation.isCancelled) throw new Error('CHECK_CANCELLED');
    if (!request.supportedProtocols.includes(this.protocol)) {
      throw new Error(`CHECK_EXECUTOR_PROTOCOL_NOT_PROMOTED:${request.semanticId}:${this.protocol}`);
    }
    if (request.executionMode !== 'SERIAL_ONLY') {
      throw new Error(`CHECK_EXECUTOR_NON_SERIAL_REQUEST:${request.semanticId}`);
    }

    if (this.lastFinishedWallClock !== undefined) {
      const remaining = this.minInterCommandDelayMs - (Date.now() - this.lastFinishedWallClock);
      if (remaining > 0) await sleep(remaining);
    }
    if (this.cancellation.isCancelled) throw new Error('CHECK_CANCELLED');

    const command = commandForPlannedRequest(request);
    const transportRequest: CommandRequest = {
      id: `${request.planRequestId}:attempt:${attemptIndex}`,
      command,
      family: familyForAuthorizedService(request.service),
      expectedService: request.expectedResponseService,
      expectedPid: request.pid,
      timeoutMs: this.requestTimeoutMs,
    };
    const result = await this.controller.executeCommand(transportRequest);
    this.lastFinishedWallClock = Date.now();
    const receipt = adaptRealCommandResultToReceipt(request, this.protocol, result, startedAt, this.provenance);
    this.onReceipt?.(request, receipt);
    return receipt;
  }

  async awaitPendingContinuation(
    request: PlannedDiagnosticRequest,
    _pendingExtensionIndex: number,
    _startedAt: number,
    _maxWaitMs: number,
  ): Promise<PlannedDiagnosticExecutionReceipt> {
    // The current BLE accumulator has no independently proven passive-wait
    // boundary. Pilot policy therefore sets maxExtensions=0 and fails closed if
    // this method is ever reached rather than re-sending the semantic command.
    throw new Error(`CHECK_PENDING_CONTINUATION_NOT_PROMOTED:${request.semanticId}`);
  }
}
