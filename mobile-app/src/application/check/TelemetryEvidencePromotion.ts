import { canAddEvidence } from '../../domain/evaluation/logic/evidencePolicy';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { EvidenceOrigin, EvidenceState, EvaluationState } from '../../domain/evaluation/models/enums';
import { DomainError } from '../../domain/shared/domainError';
import {
  EvaluationId,
  EvidenceItemId,
  LiveSessionId,
  VehicleId,
} from '../../domain/shared/identifiers';
import { Result, failure, success } from '../../domain/shared/result';
import { UtcIsoTimestamp } from '../../domain/shared/timestamps';

export interface PromoteLiveTelemetryWindowInput {
  readonly evidenceId: EvidenceItemId;
  readonly evaluationId: EvaluationId;
  readonly evaluationState: EvaluationState;
  readonly evaluationVehicleId: VehicleId;
  readonly sessionVehicleId: VehicleId;
  readonly liveSessionId: LiveSessionId;
  readonly capturedAt: UtcIsoTimestamp;
  readonly startMs: number;
  readonly endMs: number;
  readonly validEcuSampleCount: number;
  readonly totalSampleCount: number;
  readonly signalTypes: readonly string[];
  readonly connectionRecoveryCount?: number;
  readonly telemetryGapMs?: number;
  readonly sessionStatus?: string;
}

function promotionError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}

export function promoteLiveTelemetryWindow(
  input: PromoteLiveTelemetryWindowInput,
): Result<EvidenceItem, DomainError> {
  const evidencePermission = canAddEvidence(input.evaluationState);
  if (!evidencePermission.ok) return evidencePermission;

  if (input.evaluationVehicleId !== input.sessionVehicleId) {
    return failure(promotionError(
      'CHECK_EVIDENCE_VEHICLE_MISMATCH',
      'Live telemetry can only be promoted into an evaluation for the same vehicle.',
      { evaluationVehicleId: input.evaluationVehicleId, sessionVehicleId: input.sessionVehicleId },
    ));
  }

  if (!Number.isFinite(input.startMs) || !Number.isFinite(input.endMs) || input.startMs < 0 || input.endMs <= input.startMs) {
    return failure(promotionError(
      'CHECK_EVIDENCE_INVALID_WINDOW',
      'Telemetry evidence requires a finite, positive time window.',
      { startMs: input.startMs, endMs: input.endMs },
    ));
  }

  if (!Number.isInteger(input.validEcuSampleCount) || input.validEcuSampleCount <= 0) {
    return failure(promotionError(
      'CHECK_EVIDENCE_NO_ECU_SAMPLES',
      'A Live window cannot become Check evidence without at least one valid ECU-origin sample.',
      { validEcuSampleCount: input.validEcuSampleCount },
    ));
  }

  if (!Number.isInteger(input.totalSampleCount) || input.totalSampleCount < input.validEcuSampleCount) {
    return failure(promotionError(
      'CHECK_EVIDENCE_INVALID_SAMPLE_COUNTS',
      'Total sample count cannot be lower than valid ECU sample count.',
      { totalSampleCount: input.totalSampleCount, validEcuSampleCount: input.validEcuSampleCount },
    ));
  }

  const signalTypes = Array.from(new Set(input.signalTypes.filter(Boolean)));
  if (signalTypes.length === 0) {
    return failure(promotionError(
      'CHECK_EVIDENCE_NO_SIGNALS',
      'Telemetry evidence must identify at least one observed signal.',
    ));
  }

  const evidence: EvidenceItem = {
    id: input.evidenceId,
    evaluationId: input.evaluationId,
    liveSessionId: input.liveSessionId,
    origin: EvidenceOrigin.LIVE_TELEMETRY_WINDOW,
    type: 'LIVE_OBD_TELEMETRY_WINDOW',
    state: EvidenceState.COMMITTED,
    capturedAt: input.capturedAt,
    timeWindow: { startMs: input.startMs, endMs: input.endMs },
    localReference: `live-session:${input.liveSessionId}:${input.startMs}-${input.endMs}`,
    metadata: {
      vehicleId: input.sessionVehicleId,
      validEcuSampleCount: input.validEcuSampleCount,
      totalSampleCount: input.totalSampleCount,
      signalTypes,
      connectionRecoveryCount: input.connectionRecoveryCount ?? 0,
      telemetryGapMs: input.telemetryGapMs ?? 0,
      sessionStatus: input.sessionStatus ?? 'UNKNOWN',
      provenance: 'ECU_ORIGIN_LIVE_SESSION',
      synthesizedTelemetry: false,
    },
  };

  return success(evidence);
}
