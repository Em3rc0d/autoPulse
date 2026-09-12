import type { DiagnosticServiceEnvelope } from '../parsers/DiagnosticServiceEnvelope';
import type { PlannedDiagnosticRequest } from '../planner/DiagnosticScanPlanner';

export interface PlannedDiagnosticObservedResponse {
  readonly envelope: DiagnosticServiceEnvelope;
  readonly observedResponseBytes: number;
}

export interface PlannedDiagnosticExecutionReceipt {
  /**
   * One semantic request may yield responses from several ECUs. The executor
   * must preserve every normalized response instead of choosing a winner.
   */
  readonly responses: readonly PlannedDiagnosticObservedResponse[];
  readonly startedAt: number;
  readonly finishedAt: number;
}

/**
 * Execution boundary consumed by CHECK-MK6/MK7.
 *
 * It accepts only an already-authorized PlannedDiagnosticRequest. There is no
 * raw command or free-form payload method on this interface.
 *
 * RESPONSE_PENDING continuation is intentionally separate from command
 * execution so waiting for ECU continuation cannot accidentally consume a
 * retry as a second command.
 */
export interface PlannedDiagnosticExecutor {
  executeCommand(
    request: PlannedDiagnosticRequest,
    attemptIndex: number,
    startedAt: number,
  ): Promise<PlannedDiagnosticExecutionReceipt>;

  awaitPendingContinuation(
    request: PlannedDiagnosticRequest,
    pendingExtensionIndex: number,
    startedAt: number,
    maxWaitMs: number,
  ): Promise<PlannedDiagnosticExecutionReceipt>;
}
