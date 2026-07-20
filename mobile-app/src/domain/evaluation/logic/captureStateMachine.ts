import { CaptureState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

export function canTransitionCapture(current: CaptureState, next: CaptureState): Result<boolean, DomainError> {
  const allowedTransitions: Record<CaptureState, CaptureState[]> = {
    [CaptureState.CREATED]: [CaptureState.CONNECTING, CaptureState.ABORTED],
    [CaptureState.CONNECTING]: [CaptureState.CONNECTED, CaptureState.FAILED, CaptureState.ABORTED],
    [CaptureState.CONNECTED]: [CaptureState.CAPTURING, CaptureState.INTERRUPTED, CaptureState.ABORTED],
    [CaptureState.CAPTURING]: [CaptureState.COMPLETED, CaptureState.INTERRUPTED, CaptureState.ABORTED],
    [CaptureState.COMPLETED]: [],
    [CaptureState.INTERRUPTED]: [CaptureState.CONNECTING, CaptureState.ABORTED],
    [CaptureState.FAILED]: [CaptureState.CONNECTING, CaptureState.ABORTED],
    [CaptureState.ABORTED]: []
  };

  if (allowedTransitions[current].includes(next)) {
    return success(true);
  }

  return failure(createEvaluationError(
    EvaluationErrorCodes.INVALID_TRANSITION,
    `Cannot transition CaptureRun from ${current} to ${next}`,
    { current, next }
  ));
}
