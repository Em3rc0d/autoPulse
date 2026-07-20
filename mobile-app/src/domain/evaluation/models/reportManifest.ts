import { ManifestId, TechnicianId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { VehicleSnapshot } from './vehicleSnapshot';
import { EvaluationScope } from './evaluationScope';
import { CoverageAssessment } from './coverageAssessment';
import { Finding } from './finding';
import { EvidenceItem } from './evidenceItem';

export interface ReportManifest {
  readonly id: ManifestId;
  readonly vehicleSnapshot: VehicleSnapshot;
  readonly technicianId: TechnicianId;
  readonly scope: EvaluationScope;
  readonly coverage?: CoverageAssessment;
  readonly findings: readonly Finding[];
  readonly selectedEvidence: readonly EvidenceItem[];
  readonly limitations?: string;
  readonly recommendations?: string;
  readonly engineVersion: string;
  readonly catalogVersion: string;
  readonly generatedAt: UtcIsoTimestamp;
}
