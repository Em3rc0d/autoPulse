import { EvaluationState, EvidenceOrigin, EvidenceState } from '../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
  createLiveSessionId,
  createVehicleId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';
import { promoteLiveTelemetryWindow } from '../TelemetryEvidencePromotion';

const baseInput = {
  evidenceId: createEvidenceItemId('evidence-1'),
  evaluationId: createEvaluationId('evaluation-1'),
  evaluationState: EvaluationState.EVIDENCE_COLLECTION,
  evaluationVehicleId: createVehicleId('vehicle-1'),
  sessionVehicleId: createVehicleId('vehicle-1'),
  liveSessionId: createLiveSessionId('session-1'),
  capturedAt: parseUtcIsoTimestamp('2026-08-26T12:00:00Z'),
  startMs: 5_000,
  endMs: 25_000,
  validEcuSampleCount: 20,
  totalSampleCount: 24,
  signalTypes: ['RPM', 'SPEED', 'COOLANT'],
  connectionRecoveryCount: 1,
  telemetryGapMs: 1_800,
  sessionStatus: 'COMPLETED',
} as const;

describe('TelemetryEvidencePromotion', () => {
  it('promotes only real same-vehicle ECU evidence and preserves gaps/recovery metadata', () => {
    const result = promoteLiveTelemetryWindow(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok === false) throw result.error;

    expect(result.value.origin).toBe(EvidenceOrigin.LIVE_TELEMETRY_WINDOW);
    expect(result.value.state).toBe(EvidenceState.COMMITTED);
    expect(result.value.metadata).toMatchObject({
      validEcuSampleCount: 20,
      connectionRecoveryCount: 1,
      telemetryGapMs: 1800,
      synthesizedTelemetry: false,
    });
  });

  it('rejects a Live window from another vehicle', () => {
    const result = promoteLiveTelemetryWindow({
      ...baseInput,
      sessionVehicleId: createVehicleId('vehicle-2'),
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe('CHECK_EVIDENCE_VEHICLE_MISMATCH');
    }
  });

  it('rejects windows without a valid ECU-origin sample', () => {
    const result = promoteLiveTelemetryWindow({
      ...baseInput,
      validEcuSampleCount: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe('CHECK_EVIDENCE_NO_ECU_SAMPLES');
    }
  });

  it('cannot mutate a signed evaluation with new evidence', () => {
    const result = promoteLiveTelemetryWindow({
      ...baseInput,
      evaluationState: EvaluationState.SIGNED,
    });
    expect(result.ok).toBe(false);
  });
});
