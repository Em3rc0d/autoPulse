import { canTransitionEvaluation } from '../../domain/evaluation/logic/evaluationStateMachine';
import { Evaluation } from '../../domain/evaluation/models/evaluation';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { EvaluationState } from '../../domain/evaluation/models/enums';
import {
  EvaluationId,
  EvidenceItemId,
  LiveSessionId,
  TechnicianId,
  TenantId,
  VehicleId,
} from '../../domain/shared/identifiers';
import { Result, failure, success } from '../../domain/shared/result';
import { DomainError } from '../../domain/shared/domainError';
import { UtcIsoTimestamp } from '../../domain/shared/timestamps';
import {
  AutoPulseCheckCapabilityFacts,
  AutoPulseCheckPlan,
  AutoPulseCheckPurpose,
  buildAutoPulseCheckPlan,
} from './AutoPulseCheckPlan';
import { promoteLiveTelemetryWindow } from './TelemetryEvidencePromotion';

export interface AutoPulseCheckStore {
  getEvaluation(id: EvaluationId): Promise<Evaluation | null>;
  saveEvaluation(evaluation: Evaluation): Promise<void>;
  appendEvidence(evidence: EvidenceItem): Promise<void>;
}

export interface AutoPulseCheckIdFactory {
  nextEvaluationId(): EvaluationId;
  nextEvidenceItemId(): EvidenceItemId;
}

export interface CreateAutoPulseCheckInput {
  readonly tenantId: TenantId;
  readonly vehicleId: VehicleId;
  readonly technicianId: TechnicianId;
  readonly purpose: AutoPulseCheckPurpose;
  readonly capabilities: AutoPulseCheckCapabilityFacts;
  readonly symptoms?: string;
}

export interface CreatedAutoPulseCheck {
  readonly evaluation: Evaluation;
  readonly plan: AutoPulseCheckPlan;
}

export interface PromoteLiveEvidenceInput {
  readonly evaluationId: EvaluationId;
  readonly sessionVehicleId: VehicleId;
  readonly liveSessionId: LiveSessionId;
  readonly startMs: number;
  readonly endMs: number;
  readonly validEcuSampleCount: number;
  readonly totalSampleCount: number;
  readonly signalTypes: readonly string[];
  readonly connectionRecoveryCount?: number;
  readonly telemetryGapMs?: number;
  readonly sessionStatus?: string;
}

function checkError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}

export class AutoPulseCheckEngine {
  constructor(
    private readonly store: AutoPulseCheckStore,
    private readonly ids: AutoPulseCheckIdFactory,
    private readonly now: () => UtcIsoTimestamp,
  ) {}

  async createDraft(input: CreateAutoPulseCheckInput): Promise<CreatedAutoPulseCheck> {
    const plan = buildAutoPulseCheckPlan(input.purpose, input.capabilities);
    const evaluation: Evaluation = {
      id: this.ids.nextEvaluationId(),
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      technicianId: input.technicianId,
      state: EvaluationState.DRAFT,
      scope: {
        requestedItems: plan.steps.map(step => ({
          id: step.id,
          description: step.title,
          isMandatory: step.mandatory,
        })),
        description: `AutoPulse Check · ${input.purpose}`,
      },
      limitations: plan.limitations.length > 0 ? plan.limitations.join(' ') : undefined,
      symptoms: input.symptoms,
      createdAt: this.now(),
    };

    await this.store.saveEvaluation(evaluation);
    return { evaluation, plan };
  }

  async transition(
    evaluationId: EvaluationId,
    nextState: EvaluationState,
  ): Promise<Result<Evaluation, DomainError>> {
    const current = await this.store.getEvaluation(evaluationId);
    if (!current) {
      return failure(checkError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', { evaluationId }));
    }

    const allowed = canTransitionEvaluation(current.state, nextState);
    if (!allowed.ok) return allowed;

    const now = this.now();
    const updated: Evaluation = {
      ...current,
      state: nextState,
      openedAt: nextState === EvaluationState.OPEN ? (current.openedAt ?? now) : current.openedAt,
      signedAt: nextState === EvaluationState.SIGNED ? now : current.signedAt,
      cancelledAt: nextState === EvaluationState.CANCELLED ? now : current.cancelledAt,
    };

    await this.store.saveEvaluation(updated);
    return success(updated);
  }

  async promoteLiveEvidence(
    input: PromoteLiveEvidenceInput,
  ): Promise<Result<EvidenceItem, DomainError>> {
    const evaluation = await this.store.getEvaluation(input.evaluationId);
    if (!evaluation) {
      return failure(checkError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', {
        evaluationId: input.evaluationId,
      }));
    }

    const promoted = promoteLiveTelemetryWindow({
      evidenceId: this.ids.nextEvidenceItemId(),
      evaluationId: evaluation.id,
      evaluationState: evaluation.state,
      evaluationVehicleId: evaluation.vehicleId,
      sessionVehicleId: input.sessionVehicleId,
      liveSessionId: input.liveSessionId,
      capturedAt: this.now(),
      startMs: input.startMs,
      endMs: input.endMs,
      validEcuSampleCount: input.validEcuSampleCount,
      totalSampleCount: input.totalSampleCount,
      signalTypes: input.signalTypes,
      connectionRecoveryCount: input.connectionRecoveryCount,
      telemetryGapMs: input.telemetryGapMs,
      sessionStatus: input.sessionStatus,
    });

    if (!promoted.ok) return promoted;
    await this.store.appendEvidence(promoted.value);
    return promoted;
  }
}
