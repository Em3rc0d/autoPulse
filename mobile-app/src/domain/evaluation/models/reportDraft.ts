import { ReportDraftId, EvaluationId, FindingId, EvidenceItemId } from '../../shared/identifiers';
import { ReportDraftState } from './enums';

export interface ReportDraft {
  readonly id: ReportDraftId;
  readonly evaluationId: EvaluationId;
  readonly state: ReportDraftState;
  readonly visibleFindingIds: readonly FindingId[];
  readonly selectedEvidenceIds: readonly EvidenceItemId[];
  readonly customRecommendations?: string;
  readonly draftNotes?: string;
}
