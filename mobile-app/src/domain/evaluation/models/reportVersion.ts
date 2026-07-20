import { ReportVersionId, EvaluationId, ManifestId, TechnicianId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { ReportVersionState } from './enums';

export interface ReportVersion {
  readonly id: ReportVersionId;
  readonly evaluationId: EvaluationId;
  readonly versionNumber: number;
  readonly state: ReportVersionState;
  readonly manifestId: ManifestId;
  readonly integrityHash: string;
  readonly signedBy: TechnicianId;
  readonly signedAt: UtcIsoTimestamp;
  readonly supersedesVersionId?: ReportVersionId;
  readonly voidReason?: string;
}
