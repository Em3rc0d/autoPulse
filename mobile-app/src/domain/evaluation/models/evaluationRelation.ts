import { EvaluationId } from '../../shared/identifiers';

export type RelationType = 'EXTENSION' | 'REINSPECTION' | 'POST_REPAIR';

export interface EvaluationRelation {
  readonly relatedEvaluationId: EvaluationId;
  readonly relationType: RelationType;
  readonly notes?: string;
}
