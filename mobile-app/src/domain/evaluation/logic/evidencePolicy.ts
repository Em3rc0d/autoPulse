import { EvaluationState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

export function canAddEvidence(evaluationState: EvaluationState): Result<boolean, DomainError> {
  const allowedStates = [
    EvaluationState.OPEN,
    EvaluationState.EVIDENCE_COLLECTION,
    EvaluationState.IN_REVIEW,
    EvaluationState.REVIEW_PENDING
  ];

  if (allowedStates.includes(evaluationState)) {
    return success(true);
  }

  return failure(createEvaluationError(
    EvaluationErrorCodes.SIGNED_EVALUATION_MUTATION,
    `Cannot add evidence to an evaluation in state ${evaluationState}`,
    { evaluationState }
  ));
}
