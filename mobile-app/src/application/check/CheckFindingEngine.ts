import { StoredAutoPulseCheck } from './AutoPulseCheckEngine';
import { decideCheckClaimAuthority } from './CheckClaimAuthority';
import { EvaluationState, EvidenceState, FindingSeverity, FindingSource, FindingStatus, ConfidenceLevel } from '../../domain/evaluation/models/enums';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { Finding } from '../../domain/evaluation/models/finding';
import { ProfessionalReview } from '../../domain/evaluation/models/professionalReview';
import { DomainError } from '../../domain/shared/domainError';
import { EvaluationId, FindingId, TechnicianId } from '../../domain/shared/identifiers';
import { Result, failure, success } from '../../domain/shared/result';
import { UtcIsoTimestamp } from '../../domain/shared/timestamps';

export interface CheckFindingEvaluationSource {
  getEvaluation(id: EvaluationId): Promise<StoredAutoPulseCheck | null>;
}

export interface CheckFindingEvidenceSource {
  listEvidence(evaluationId: string): Promise<EvidenceItem[]>;
}

export interface CheckFindingStore {
  getFinding(findingId: string): Promise<Finding | null>;
  listFindings(evaluationId: string): Promise<Finding[]>;
  saveFinding(finding: Finding): Promise<void>;
}

export interface CheckFindingIdFactory {
  nextFindingId(): FindingId;
}

export interface ReviewFindingInput {
  readonly evaluationId: EvaluationId;
  readonly findingId: FindingId;
  readonly technicianId: TechnicianId;
  readonly finalStatus: Exclude<FindingStatus, FindingStatus.PROPOSED>;
  readonly finalSeverity: FindingSeverity;
  readonly finalConfidence: ConfidenceLevel;
  readonly comment?: string;
  readonly justification?: string;
}

function findingError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function makeSystemFinding(
  id: FindingId,
  evaluationId: EvaluationId,
  evidence: EvidenceItem,
  ruleId: string,
  severity: FindingSeverity,
  confidence: ConfidenceLevel,
  matchedConditions: string[],
  technicalExplanation: string,
  clientExplanation: string,
  suggestedAction: string,
  limitations: string,
): Finding {
  const authority = decideCheckClaimAuthority('FINDING', 'SYSTEM');
  if (!authority.allowed || !authority.findingSource) {
    throw new Error(authority.reason);
  }

  return {
    id,
    evaluationId,
    source: authority.findingSource,
    status: FindingStatus.PROPOSED,
    severity,
    confidence,
    evidenceIds: [evidence.id],
    systemProposal: {
      ruleId,
      ruleVersion: 'AUTOPULSE_CHECK_RULES_V1',
      proposedSeverity: severity,
      proposedConfidence: confidence,
      usedEvidenceIds: [evidence.id],
      matchedConditions,
      missingData: [],
    },
    technicalExplanation,
    clientExplanation,
    suggestedAction,
    limitations,
  };
}

export class CheckFindingEngine {
  constructor(
    private readonly evaluations: CheckFindingEvaluationSource,
    private readonly evidenceSource: CheckFindingEvidenceSource,
    private readonly findings: CheckFindingStore,
    private readonly ids: CheckFindingIdFactory,
    private readonly now: () => UtcIsoTimestamp,
  ) {}

  async generateSystemProposals(evaluationId: EvaluationId): Promise<Result<Finding[], DomainError>> {
    const check = await this.evaluations.getEvaluation(evaluationId);
    if (!check) {
      return failure(findingError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', { evaluationId }));
    }
    if (
      check.evaluation.state === EvaluationState.SIGNED
      || check.evaluation.state === EvaluationState.DELIVERED
      || check.evaluation.state === EvaluationState.CANCELLED
    ) {
      return failure(findingError(
        'CHECK_FINDINGS_IMMUTABLE',
        'System findings cannot be generated after the evaluation is closed.',
        { evaluationId, state: check.evaluation.state },
      ));
    }

    const evidenceItems = (await this.evidenceSource.listEvidence(evaluationId))
      .filter(item => item.state === EvidenceState.COMMITTED);
    const existing = await this.findings.listFindings(evaluationId);
    const existingKeys = new Set(existing.flatMap(finding =>
      finding.systemProposal?.usedEvidenceIds.map(id => `${finding.systemProposal?.ruleId}:${id}`) ?? []
    ));
    const generated: Finding[] = [];

    for (const evidence of evidenceItems) {
      if (evidence.type === 'OBD_STORED_DTC_SCAN') {
        const codes = stringArray(evidence.metadata?.diagnosticCodes);
        const key = `CHECK_STORED_DTC_PRESENT:${evidence.id}`;
        if (codes.length > 0 && !existingKeys.has(key)) {
          generated.push(makeSystemFinding(
            this.ids.nextFindingId(),
            evaluationId,
            evidence,
            'CHECK_STORED_DTC_PRESENT',
            FindingSeverity.ATENCION_REQUERIDA,
            ConfidenceLevel.HIGH,
            [`stored_dtc_count=${codes.length}`, `codes=${codes.join(',')}`],
            `Standard OBD stored-DTC service returned ${codes.join(', ')} during this evaluation.`,
            `The vehicle reported ${codes.length} stored diagnostic code${codes.length === 1 ? '' : 's'} during this Check.`,
            'Review each code with symptoms and supporting evidence before deciding on a repair.',
            'A stored DTC is an ECU record. It does not by itself establish root cause, current severity or the required repair.',
          ));
        }
      }

      if (evidence.type === 'OBD_MONITOR_STATUS_PID01') {
        const monitor = evidence.metadata?.monitorStatus as { milOn?: boolean; confirmedDtcCount?: number } | null | undefined;
        const key = `CHECK_MIL_ON:${evidence.id}`;
        if (monitor?.milOn === true && !existingKeys.has(key)) {
          generated.push(makeSystemFinding(
            this.ids.nextFindingId(),
            evaluationId,
            evidence,
            'CHECK_MIL_ON',
            FindingSeverity.ATENCION_REQUERIDA,
            ConfidenceLevel.HIGH,
            ['mil_on=true', `confirmed_dtc_count=${monitor.confirmedDtcCount ?? 'unknown'}`],
            'Mode 01 PID 01 reported the malfunction indicator lamp as ON.',
            'The vehicle reported the check-engine/MIL indicator as active during this Check.',
            'Correlate the MIL state with stored/pending codes and vehicle symptoms before a repair conclusion.',
            'AutoPulse currently records the MIL flag and confirmed-DTC count from PID 01; detailed readiness-monitor breakdown is not yet decoded.',
          ));
        }
      }

      if (evidence.type === 'OBD_FREEZE_FRAME_TRIGGER') {
        const trigger = evidence.metadata?.freezeFrameTrigger as { triggerDtc?: string; frameNumber?: number } | null | undefined;
        const key = `CHECK_FREEZE_FRAME_TRIGGER_PRESENT:${evidence.id}`;
        if (trigger && !existingKeys.has(key)) {
          generated.push(makeSystemFinding(
            this.ids.nextFindingId(),
            evaluationId,
            evidence,
            'CHECK_FREEZE_FRAME_TRIGGER_PRESENT',
            FindingSeverity.INFORMATIVO,
            ConfidenceLevel.HIGH,
            [`frame_number=${trigger.frameNumber ?? 'unknown'}`, `trigger_dtc=${trigger.triggerDtc ?? 'not_decoded'}`],
            `Mode 02 returned freeze-frame trigger evidence${trigger.triggerDtc ? ` associated with ${trigger.triggerDtc}` : ''}.`,
            'Freeze-frame trigger evidence was available from the vehicle during this Check.',
            'Use the trigger as supporting context together with DTC and telemetry evidence.',
            'This rule confirms only the trigger/frame evidence. It does not claim that the full freeze-frame PID set was captured.',
          ));
        }
      }
    }

    for (const finding of generated) await this.findings.saveFinding(finding);
    return success(generated);
  }

  async reviewFinding(input: ReviewFindingInput): Promise<Result<Finding, DomainError>> {
    const check = await this.evaluations.getEvaluation(input.evaluationId);
    if (!check) {
      return failure(findingError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', {
        evaluationId: input.evaluationId,
      }));
    }
    if (check.evaluation.state !== EvaluationState.IN_REVIEW) {
      return failure(findingError(
        'CHECK_FINDING_REVIEW_STATE_REQUIRED',
        'Professional finding review is only allowed while the evaluation is IN_REVIEW.',
        { evaluationId: input.evaluationId, state: check.evaluation.state },
      ));
    }

    const current = await this.findings.getFinding(input.findingId);
    if (!current || current.evaluationId !== input.evaluationId) {
      return failure(findingError('CHECK_FINDING_NOT_FOUND', 'Finding was not found in this evaluation.', {
        evaluationId: input.evaluationId,
        findingId: input.findingId,
      }));
    }

    const authority = decideCheckClaimAuthority('PROFESSIONAL_CONCLUSION', 'TECHNICIAN');
    if (!authority.allowed) {
      return failure(findingError('CHECK_PROFESSIONAL_REVIEW_FORBIDDEN', authority.reason));
    }

    const professionalReview: ProfessionalReview = {
      technicianId: input.technicianId,
      finalStatus: input.finalStatus,
      finalSeverity: input.finalSeverity,
      finalConfidence: input.finalConfidence,
      comment: input.comment,
      justification: input.justification,
      reviewedAt: this.now(),
    };

    const updated: Finding = {
      ...current,
      source: input.finalStatus === FindingStatus.MODIFIED && current.source === FindingSource.SYSTEM_RULE
        ? FindingSource.HYBRID
        : current.source,
      status: input.finalStatus,
      severity: input.finalSeverity,
      confidence: input.finalConfidence,
      professionalReview,
    };

    await this.findings.saveFinding(updated);
    return success(updated);
  }
}
