import { EvidenceItemId } from '../../shared/identifiers';
import { FindingSeverity, ConfidenceLevel } from './enums';

export interface RuleExecutionResult {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly proposedSeverity: FindingSeverity;
  readonly proposedConfidence: ConfidenceLevel;
  readonly usedEvidenceIds: readonly EvidenceItemId[];
  readonly matchedConditions: readonly string[];
  readonly missingData: readonly string[];
}
