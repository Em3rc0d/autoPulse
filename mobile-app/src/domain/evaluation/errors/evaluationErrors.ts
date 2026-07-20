import { DomainError } from '../../shared/domainError';

export const EvaluationErrorCodes = {
  INVALID_TRANSITION: 'EVAL-001',
  UNRESOLVED_FINDINGS: 'EVAL-002',
  UNCOMMITTED_EVIDENCE: 'EVAL-003',
  COVERAGE_NOT_ASSESSED: 'EVAL-004',
  MISSING_LIMITATIONS: 'EVAL-005',
  MISSING_EVIDENCE_REFERENCE: 'EVAL-006',
  IMMUTABLE_REPORT_VERSION: 'EVAL-007',
  SIGNED_EVALUATION_MUTATION: 'EVAL-008',
  INVALID_RELATION: 'EVAL-009'
} as const;

export function createEvaluationError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}
