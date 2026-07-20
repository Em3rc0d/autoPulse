import { EvaluationState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

export function canTransitionEvaluation(current: EvaluationState, next: EvaluationState): Result<boolean, DomainError> {
  const allowedTransitions: Record<EvaluationState, EvaluationState[]> = {
    [EvaluationState.DRAFT]: [EvaluationState.OPEN, EvaluationState.CANCELLED],
    [EvaluationState.OPEN]: [EvaluationState.EVIDENCE_COLLECTION, EvaluationState.CANCELLED],
    [EvaluationState.EVIDENCE_COLLECTION]: [EvaluationState.REVIEW_PENDING, EvaluationState.OPEN, EvaluationState.CANCELLED],
    [EvaluationState.REVIEW_PENDING]: [EvaluationState.IN_REVIEW, EvaluationState.EVIDENCE_COLLECTION, EvaluationState.CANCELLED],
    [EvaluationState.IN_REVIEW]: [EvaluationState.READY_FOR_SIGNATURE, EvaluationState.EVIDENCE_COLLECTION, EvaluationState.CANCELLED],
    [EvaluationState.READY_FOR_SIGNATURE]: [EvaluationState.SIGNED, EvaluationState.IN_REVIEW, EvaluationState.CANCELLED],
    [EvaluationState.SIGNED]: [EvaluationState.DELIVERED],
    [EvaluationState.DELIVERED]: [],
    [EvaluationState.CANCELLED]: []
  };

  if (allowedTransitions[current].includes(next)) {
    return success(true);
  }

  return failure(createEvaluationError(
    EvaluationErrorCodes.INVALID_TRANSITION,
    `Cannot transition Evaluation from ${current} to ${next}`,
    { current, next }
  ));
}
