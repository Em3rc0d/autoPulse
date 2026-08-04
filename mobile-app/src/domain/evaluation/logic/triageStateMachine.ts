import { TriageExecutionState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

const triageTransitions: Record<TriageExecutionState, TriageExecutionState[]> = {
  [TriageExecutionState.PENDING]: [TriageExecutionState.RUNNING, TriageExecutionState.SUPERSEDED],
  [TriageExecutionState.RUNNING]: [TriageExecutionState.COMPLETED, TriageExecutionState.FAILED],
  [TriageExecutionState.COMPLETED]: [TriageExecutionState.SUPERSEDED],
  [TriageExecutionState.FAILED]: [TriageExecutionState.SUPERSEDED],
  [TriageExecutionState.SUPERSEDED]: []
};

export function canTransitionTriageExecution(current: TriageExecutionState, next: TriageExecutionState): Result<boolean, DomainError> {
  const allowed = triageTransitions[current];
  if (allowed.includes(next)) {
    return success(true);
  }
  return failure(createEvaluationError(
    EvaluationErrorCodes.INVALID_TRANSITION,
    `Cannot transition TriageExecution from ${current} to ${next}`,
    { current, next }
  ));
}
