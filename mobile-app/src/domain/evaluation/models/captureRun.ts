import { CaptureRunId, EvaluationId, EvidenceItemId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { DurationMs } from '../../shared/durations';
import { CaptureState, CaptureContext } from './enums';
import { CapabilitySnapshot } from '../../acquisition/models/capabilitySnapshot';
import { ConnectionQualitySummary } from '../../acquisition/models/connectionQuality';

export interface CaptureRun {
  readonly id: CaptureRunId;
  readonly evaluationId: EvaluationId;
  readonly context: CaptureContext;
  readonly state: CaptureState;
  readonly capabilitySnapshot?: CapabilitySnapshot;
  readonly startedAt?: UtcIsoTimestamp;
  readonly endedAt?: UtcIsoTimestamp;
  readonly durationMs?: DurationMs;
  readonly interruptionReason?: string;
  readonly qualitySummary?: ConnectionQualitySummary;
  readonly evidenceReferences: readonly EvidenceItemId[];
}
