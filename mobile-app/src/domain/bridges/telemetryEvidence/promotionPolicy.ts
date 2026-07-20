import { TelemetryWindow } from '../../telemetry/models/telemetryWindow';
import { Evaluation } from '../../evaluation/models/evaluation';
import { EvidenceItem } from '../../evaluation/models/evidenceItem';
import { EvidenceOrigin, EvidenceState } from '../../evaluation/models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { createEvidenceItemId, EvidenceItemId } from '../../shared/identifiers';
import { nowUtc } from '../../shared/timestamps';
import { BridgeErrorCodes, createBridgeError } from './errors';
import { canAddEvidence } from '../../evaluation/logic/evidencePolicy';
import { TelemetryEvidencePromoter } from './contracts';

export class DefaultTelemetryEvidencePromoter implements TelemetryEvidencePromoter {
  promoteWindow(
    window: TelemetryWindow,
    targetEvaluation: Evaluation,
    newEvidenceId: EvidenceItemId,
    providedContentHash?: string
  ): Result<EvidenceItem, DomainError> {
    const evidenceCheck = canAddEvidence(targetEvaluation.state);
    if (!evidenceCheck.ok) {
      return failure(createBridgeError(
        BridgeErrorCodes.EVALUATION_NOT_ACCEPTING_EVIDENCE,
        'Target evaluation is not in a state that accepts new evidence',
        { evaluationState: targetEvaluation.state }
      ));
    }

    if (window.frames.length === 0) {
      return failure(createBridgeError(
        BridgeErrorCodes.WINDOW_NOT_FROZEN,
        'Cannot promote an empty or unfrozen window'
      ));
    }

    const evidence: EvidenceItem = {
      id: newEvidenceId,
      evaluationId: targetEvaluation.id,
      liveSessionId: window.sessionId,
      origin: EvidenceOrigin.LIVE_TELEMETRY_WINDOW,
      type: 'TELEMETRY_WINDOW',
      state: EvidenceState.STAGED, // The evidence is staged and uncommitted until handled by the store
      capturedAt: nowUtc(),
      contentHash: providedContentHash,
      timeWindow: {
        startMs: window.frames[0].elapsedMs,
        endMs: window.frames[window.frames.length - 1].elapsedMs
      }
    };

    return success(evidence);
  }
}
