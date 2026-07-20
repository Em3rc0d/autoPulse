import { TelemetryWindow } from '../../telemetry/models/telemetryWindow';
import { Evaluation } from '../../evaluation/models/evaluation';
import { EvidenceItem } from '../../evaluation/models/evidenceItem';
import { Result } from '../../shared/result';
import { DomainError } from '../../shared/domainError';

import { EvidenceItemId } from '../../shared/identifiers';

export interface TelemetryEvidencePromoter {
  promoteWindow(
    window: TelemetryWindow,
    targetEvaluation: Evaluation,
    newEvidenceId: EvidenceItemId,
    providedContentHash?: string
  ): Result<EvidenceItem, DomainError>;
}
