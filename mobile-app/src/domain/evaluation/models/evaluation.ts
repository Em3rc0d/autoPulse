import { EvaluationId, TenantId, VehicleId, TechnicianId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { EvaluationState } from './enums';
import { EvaluationScope } from './evaluationScope';
import { CoverageAssessment } from './coverageAssessment';
import { VehicleSnapshot } from './vehicleSnapshot';

export interface Evaluation {
  readonly id: EvaluationId;
  readonly tenantId: TenantId;
  readonly vehicleId: VehicleId;
  readonly technicianId: TechnicianId;
  readonly state: EvaluationState;
  readonly scope: EvaluationScope;
  readonly coverage?: CoverageAssessment;
  readonly limitations?: string;
  readonly symptoms?: string;
  readonly vehicleSnapshot?: VehicleSnapshot;
  readonly createdAt: UtcIsoTimestamp;
  readonly openedAt?: UtcIsoTimestamp;
  readonly signedAt?: UtcIsoTimestamp;
  readonly cancelledAt?: UtcIsoTimestamp;
}
