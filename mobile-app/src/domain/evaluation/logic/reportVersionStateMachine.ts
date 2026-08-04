import { ReportVersionState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

const versionTransitions: Record<ReportVersionState, ReportVersionState[]> = {
  [ReportVersionState.SIGNED]: [ReportVersionState.DELIVERED, ReportVersionState.SUPERSEDED, ReportVersionState.VOID],
  [ReportVersionState.DELIVERED]: [ReportVersionState.SUPERSEDED, ReportVersionState.VOID],
  [ReportVersionState.SUPERSEDED]: [],
  [ReportVersionState.VOID]: []
};

export function canTransitionReportVersion(current: ReportVersionState, next: ReportVersionState): Result<boolean, DomainError> {
  const allowed = versionTransitions[current];
  if (allowed.includes(next)) {
    return success(true);
  }
  return failure(createEvaluationError(
    EvaluationErrorCodes.INVALID_TRANSITION,
    `Cannot transition ReportVersion from ${current} to ${next}`,
    { current, next }
  ));
}
