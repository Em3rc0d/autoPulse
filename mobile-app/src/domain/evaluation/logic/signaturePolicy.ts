import { Evaluation } from '../models/evaluation';
import { Finding } from '../models/finding';
import { EvidenceItem } from '../models/evidenceItem';
import { FindingStatus, EvidenceState, CoverageLevel } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { EvaluationErrorCodes, createEvaluationError } from '../errors/evaluationErrors';

export function validateSignatureRequirements(
  evaluation: Evaluation,
  findings: readonly Finding[],
  evidenceItems: readonly EvidenceItem[]
): Result<boolean, DomainError> {
  const unresolvedFindings = findings.filter(f => f.status === FindingStatus.PROPOSED);
  if (unresolvedFindings.length > 0) {
    return failure(createEvaluationError(
      EvaluationErrorCodes.UNRESOLVED_FINDINGS,
      'Cannot sign evaluation with PROPOSED findings',
      { findingIds: unresolvedFindings.map(f => f.id) }
    ));
  }

  const uncommittedEvidence = evidenceItems.filter(e => e.state === EvidenceState.STAGED || e.state === EvidenceState.FILE_READY);
  if (uncommittedEvidence.length > 0) {
    return failure(createEvaluationError(
      EvaluationErrorCodes.UNCOMMITTED_EVIDENCE,
      'Cannot sign evaluation with uncommitted evidence',
      { evidenceIds: uncommittedEvidence.map(e => e.id) }
    ));
  }

  if (!evaluation.coverage || evaluation.coverage.overallLevel === CoverageLevel.NOT_ASSESSED) {
    return failure(createEvaluationError(
      EvaluationErrorCodes.COVERAGE_NOT_ASSESSED,
      'Coverage must be assessed before signing'
    ));
  }

  if (!evaluation.limitations || evaluation.limitations.trim().length === 0) {
    return failure(createEvaluationError(
      EvaluationErrorCodes.MISSING_LIMITATIONS,
      'Limitations must be documented before signing'
    ));
  }

  return success(true);
}
