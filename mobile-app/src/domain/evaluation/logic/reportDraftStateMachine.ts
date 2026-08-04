import { ReportDraftState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

const draftTransitions: Record<ReportDraftState, ReportDraftState[]> = {
  [ReportDraftState.DRAFT]: [ReportDraftState.IN_REVIEW, ReportDraftState.READY_FOR_SIGNATURE, ReportDraftState.DISCARDED],
  [ReportDraftState.IN_REVIEW]: [ReportDraftState.DRAFT, ReportDraftState.READY_FOR_SIGNATURE, ReportDraftState.DISCARDED],
  [ReportDraftState.READY_FOR_SIGNATURE]: [ReportDraftState.DRAFT, ReportDraftState.IN_REVIEW, ReportDraftState.DISCARDED],
  [ReportDraftState.DISCARDED]: []
};

export function canTransitionReportDraft(current: ReportDraftState, next: ReportDraftState): Result<boolean, DomainError> {
  const allowed = draftTransitions[current];
  if (allowed.includes(next)) {
    return success(true);
  }
  return failure(createEvaluationError(
    EvaluationErrorCodes.INVALID_TRANSITION,
    `Cannot transition ReportDraft from ${current} to ${next}`,
    { current, next }
  ));
}
