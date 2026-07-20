import { TechnicianId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { FindingStatus, FindingSeverity, ConfidenceLevel } from './enums';

export interface ProfessionalReview {
  readonly technicianId: TechnicianId;
  readonly finalStatus: FindingStatus;
  readonly finalSeverity: FindingSeverity;
  readonly finalConfidence: ConfidenceLevel;
  readonly comment?: string;
  readonly justification?: string;
  readonly reviewedAt: UtcIsoTimestamp;
}
