import { canAddEvidence } from '../../domain/evaluation/logic/evidencePolicy';
import {
  DiagnosticConnector,
  DiagnosticRequest,
  DiagnosticResponse,
} from '../../domain/diagnostics/DiagnosticConnector';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { EvidenceOrigin, EvidenceState, EvaluationState } from '../../domain/evaluation/models/enums';
import { DomainError } from '../../domain/shared/domainError';
import { EvaluationId, EvidenceItemId, TechnicianId } from '../../domain/shared/identifiers';
import { Result, failure, success } from '../../domain/shared/result';
import { UtcIsoTimestamp } from '../../domain/shared/timestamps';

export type CheckDiagnosticCaptureKind = 'STORED_DTC' | 'READINESS' | 'FREEZE_FRAME_TRIGGER';

export interface CheckDiagnosticCaptureInput {
  readonly evidenceId: EvidenceItemId;
  readonly evaluationId: EvaluationId;
  readonly evaluationState: EvaluationState;
  readonly kind: CheckDiagnosticCaptureKind;
  readonly capturedAt: UtcIsoTimestamp;
  readonly createdBy?: TechnicianId;
}

export interface CheckDiagnosticCaptureOutput {
  readonly evidence: EvidenceItem;
  readonly response: DiagnosticResponse;
}

function captureError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}

function requestFor(kind: CheckDiagnosticCaptureKind): DiagnosticRequest {
  const nonce = Math.random().toString(36).slice(2);
  switch (kind) {
    case 'STORED_DTC':
      return {
        id: `check:stored-dtc:${nonce}`,
        payload: '03',
        kind: 'OBD_STANDARD',
        expectedService: '43',
        timeoutMs: 5000,
      };
    case 'READINESS':
      return {
        id: `check:readiness:${nonce}`,
        payload: '0101',
        kind: 'OBD_STANDARD',
        expectedService: '41',
        expectedPid: '01',
        timeoutMs: 5000,
      };
    case 'FREEZE_FRAME_TRIGGER':
      return {
        id: `check:freeze-frame-trigger:${nonce}`,
        payload: '020200',
        kind: 'OBD_STANDARD',
        expectedService: '42',
        expectedPid: '02',
        timeoutMs: 5000,
      };
  }
}

function evidenceTypeFor(kind: CheckDiagnosticCaptureKind): string {
  switch (kind) {
    case 'STORED_DTC': return 'OBD_STORED_DTC_SCAN';
    case 'READINESS': return 'OBD_MONITOR_STATUS_PID01';
    case 'FREEZE_FRAME_TRIGGER': return 'OBD_FREEZE_FRAME_TRIGGER';
  }
}

function coverageFor(kind: CheckDiagnosticCaptureKind): string {
  switch (kind) {
    case 'STORED_DTC': return 'STANDARD_OBD_STORED_DTC_SERVICE';
    case 'READINESS': return 'PARTIAL_MONITOR_SUMMARY';
    case 'FREEZE_FRAME_TRIGGER': return 'TRIGGER_DTC_PROBE_ONLY';
  }
}

function evidenceStateFor(response: DiagnosticResponse): EvidenceState {
  return response.status === 'SUCCESS' || response.status === 'NO_DATA' || response.status === 'UNSUPPORTED'
    ? EvidenceState.COMMITTED
    : EvidenceState.FAILED;
}

/**
 * Executes one bounded, read-only standard OBD capture for AutoPulse Check.
 * The result preserves transport/execution status and raw evidence; it never
 * translates NO_DATA/UNSUPPORTED into a healthy PASS claim.
 */
export async function captureCheckDiagnosticEvidence(
  connector: DiagnosticConnector,
  input: CheckDiagnosticCaptureInput,
): Promise<Result<CheckDiagnosticCaptureOutput, DomainError>> {
  const permission = canAddEvidence(input.evaluationState);
  if (permission.ok === false) return failure(permission.error);

  const capabilities = await connector.discoverCapabilities();
  if (!capabilities.requestKinds.includes('OBD_STANDARD')) {
    return failure(captureError(
      'CHECK_DIAGNOSTIC_STANDARD_OBD_UNSUPPORTED',
      'The connected diagnostic interface does not advertise standard OBD requests.',
      { kind: input.kind },
    ));
  }

  const request = requestFor(input.kind);
  let response: DiagnosticResponse;
  try {
    response = await connector.execute(request);
  } catch (error) {
    return failure(captureError(
      'CHECK_DIAGNOSTIC_EXECUTION_EXCEPTION',
      'The read-only diagnostic capture threw before an evidence response could be recorded.',
      { kind: input.kind, error: error instanceof Error ? error.message : String(error) },
    ));
  }

  const metadata: Record<string, unknown> = {
    captureKind: input.kind,
    executionStatus: response.status,
    sourceEcus: [...response.sourceEcus],
    latencyMs: response.latencyMs,
    errors: [...response.errors],
    rawText: response.rawText ?? null,
    coverage: coverageFor(input.kind),
    vehicleWritePerformed: false,
  };

  if (input.kind === 'STORED_DTC') {
    metadata.diagnosticCodes = [...(response.diagnosticCodes ?? [])];
  }

  if (input.kind === 'READINESS') {
    metadata.monitorStatus = response.monitorStatus ?? null;
    metadata.detailedMonitorBreakdownDecoded = false;
  }

  if (input.kind === 'FREEZE_FRAME_TRIGGER') {
    metadata.freezeFrameTrigger = response.freezeFrameTrigger ?? null;
    metadata.fullFreezeFrameCaptured = false;
  }

  const evidence: EvidenceItem = {
    id: input.evidenceId,
    evaluationId: input.evaluationId,
    origin: EvidenceOrigin.OBD_CAPTURE,
    type: evidenceTypeFor(input.kind),
    state: evidenceStateFor(response),
    capturedAt: input.capturedAt,
    metadata,
    createdBy: input.createdBy,
  };

  return success({ evidence, response });
}
