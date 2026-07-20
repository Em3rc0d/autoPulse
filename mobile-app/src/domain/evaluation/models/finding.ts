import { FindingId, EvaluationId, EvidenceItemId } from '../../shared/identifiers';
import { FindingSource, FindingStatus, FindingSeverity, ConfidenceLevel } from './enums';
import { RuleExecutionResult } from './ruleExecutionResult';
import { ProfessionalReview } from './professionalReview';

export interface Finding {
  readonly id: FindingId;
  readonly evaluationId: EvaluationId;
  readonly source: FindingSource;
  readonly status: FindingStatus;
  readonly systemProposal?: RuleExecutionResult;
  readonly professionalReview?: ProfessionalReview;
  readonly severity: FindingSeverity;
  readonly confidence: ConfidenceLevel;
  readonly evidenceIds: readonly EvidenceItemId[];
  readonly technicalExplanation?: string;
  readonly clientExplanation?: string;
  readonly suggestedAction?: string;
  readonly limitations?: string;
}
