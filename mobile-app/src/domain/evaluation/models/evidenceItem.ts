import { EvidenceItemId, EvaluationId, CaptureRunId, LiveSessionId, TechnicianId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { EvidenceState, EvidenceOrigin } from './enums';

export interface TimeWindow {
  readonly startMs: number;
  readonly endMs: number;
}

export interface EvidenceItem {
  readonly id: EvidenceItemId;
  readonly evaluationId: EvaluationId;
  readonly captureRunId?: CaptureRunId;
  readonly liveSessionId?: LiveSessionId;
  readonly origin: EvidenceOrigin;
  readonly type: string;
  readonly state: EvidenceState;
  readonly capturedAt: UtcIsoTimestamp;
  readonly contentHash?: string;
  readonly localReference?: string;
  readonly metadata?: Record<string, any>;
  readonly timeWindow?: TimeWindow;
  readonly createdBy?: TechnicianId;
}
