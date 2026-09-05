import type { DiagnosticServiceEnvelope } from '../parsers/DiagnosticServiceEnvelope';
import type { PlannedDiagnosticRequest } from '../planner/DiagnosticScanPlanner';

export interface PlannedDiagnosticExecutionReceipt {
  readonly envelope: DiagnosticServiceEnvelope;
  readonly observedResponseBytes: number;
  readonly startedAt: number;
  readonly finishedAt: number;
}

/**
 * Execution boundary consumed by CHECK-MK6.
 *
 * It accepts only an already-authorized PlannedDiagnosticRequest. There is no
 * raw command or free-form payload method on this interface.
 *
 * RESPONSE_PENDING continuation is intentionally separate from command
 * execution so waiting for an ECU continuation cannot accidentally consume a
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
