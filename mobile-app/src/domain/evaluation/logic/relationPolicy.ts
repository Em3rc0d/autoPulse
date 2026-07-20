import { EvaluationRelation, RelationType } from '../models/evaluationRelation';
import { Evaluation } from '../models/evaluation';
import { EvaluationState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

export function validateRelation(
  sourceEvaluation: Evaluation,
  targetEvaluationState: EvaluationState,
  relationType: RelationType
): Result<EvaluationRelation, DomainError> {
  if (targetEvaluationState !== EvaluationState.SIGNED && targetEvaluationState !== EvaluationState.DELIVERED) {
    return failure(createEvaluationError(
      EvaluationErrorCodes.INVALID_RELATION,
      'Can only relate to a completed evaluation',
      { targetEvaluationState }
    ));
  }

  return success({
    relatedEvaluationId: sourceEvaluation.id,
    relationType
  });
}
