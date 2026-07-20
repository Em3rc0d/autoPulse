import { TriageExecutionId, EvaluationId, EvidenceItemId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { TriageExecutionState } from './enums';
import { RuleExecutionResult } from './ruleExecutionResult';

export interface TriageExecution {
  readonly id: TriageExecutionId;
  readonly evaluationId: EvaluationId;
  readonly state: TriageExecutionState;
  readonly engineVersion: string;
  readonly catalogVersion: string;
  readonly startedAt: UtcIsoTimestamp;
  readonly finishedAt?: UtcIsoTimestamp;
  readonly inputEvidenceIds: readonly EvidenceItemId[];
  readonly results: readonly RuleExecutionResult[];
  readonly error?: string;
}
