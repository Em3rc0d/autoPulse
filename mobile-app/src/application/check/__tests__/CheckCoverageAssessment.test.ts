import { assessCheckCoverage } from '../CheckCoverageAssessment';
import { StoredAutoPulseCheck } from '../AutoPulseCheckEngine';
import {
  CaptureContext,
  CoverageLevel,
  EvidenceOrigin,
  EvidenceState,
  EvaluationState,
} from '../../../domain/evaluation/models/enums';
import { EvidenceItem } from '../../../domain/evaluation/models/evidenceItem';
import {
  createEvaluationId,
  createEvidenceItemId,
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';

const check: StoredAutoPulseCheck = {
  evaluation: {
    id: createEvaluationId('evaluation-1'),
    tenantId: createTenantId('tenant-1'),
    vehicleId: createVehicleId('vehicle-1'),
    technicianId: createTechnicianId('tech-1'),
    state: EvaluationState.IN_REVIEW,
    scope: { requestedItems: [] },
    createdAt: parseUtcIsoTimestamp('2026-08-27T10:00:00Z'),
  },
  purpose: 'PREVENTIVE',
  capabilities: {
    obd: 'SUPPORTED',
    dtcRead: 'SUPPORTED',
    readiness: 'SUPPORTED',
    freezeFrame: 'UNKNOWN',
    liveTelemetry: 'SUPPORTED',
    availableSignals: ['010C', '0105'],
  },
};

function evidence(id: string, type: string, metadata?: Record<string, unknown>): EvidenceItem {
  return {
    id: createEvidenceItemId(id),
    evaluationId: check.evaluation.id,
    origin: type === 'LIVE_OBD_TELEMETRY_WINDOW' ? EvidenceOrigin.LIVE_TELEMETRY_WINDOW : EvidenceOrigin.OBD_CAPTURE,
    type,
    state: EvidenceState.COMMITTED,
    capturedAt: parseUtcIsoTimestamp('2026-08-27T10:10:00Z'),
    metadata,
  };
}

describe('CheckCoverageAssessment', () => {
  it('reports PARTIAL coverage when electronic evidence exists but the mandatory visual baseline is missing', () => {
    const result = assessCheckCoverage(check, [
      evidence('cap', 'OBD_CAPABILITY_DISCOVERY'),
      evidence('dtc', 'OBD_STORED_DTC_SCAN'),
      evidence('readiness', 'OBD_MONITOR_STATUS_PID01'),
      evidence('idle', 'LIVE_OBD_TELEMETRY_WINDOW', { captureContext: CaptureContext.IDLE }),
    ], '2026-08-27T11:00:00.000Z');

    expect(result.coverage.overallLevel).toBe(CoverageLevel.PARTIAL);
    expect(result.limitations.some(item => item.includes('Visual and manual baseline'))).toBe(true);
  });

  it('reaches HIGH only when every mandatory evidence step for the purpose is actually covered', () => {
    const result = assessCheckCoverage(check, [
      evidence('visual', 'CHECK_VISUAL_BASELINE'),
      evidence('cap', 'OBD_CAPABILITY_DISCOVERY'),
      evidence('dtc', 'OBD_STORED_DTC_SCAN'),
      evidence('readiness', 'OBD_MONITOR_STATUS_PID01'),
      evidence('idle', 'LIVE_OBD_TELEMETRY_WINDOW', { captureContext: CaptureContext.IDLE }),
    ], '2026-08-27T11:00:00.000Z');

    expect(result.coverage.overallLevel).toBe(CoverageLevel.HIGH);
  });

  it('does not count failed evidence as covered', () => {
    const failed = {
      ...evidence('dtc', 'OBD_STORED_DTC_SCAN'),
      state: EvidenceState.FAILED,
    };
    const result = assessCheckCoverage(check, [failed], '2026-08-27T11:00:00.000Z');
    expect(result.coverage.overallLevel).toBe(CoverageLevel.LIMITED);
    expect(result.limitations.some(item => item.includes('did not produce committed evidence'))).toBe(true);
  });

  it('requires road telemetry for a pre-purchase Check', () => {
    const prePurchase: StoredAutoPulseCheck = { ...check, purpose: 'PRE_PURCHASE' };
    const result = assessCheckCoverage(prePurchase, [
      evidence('visual', 'CHECK_VISUAL_BASELINE'),
      evidence('cap', 'OBD_CAPABILITY_DISCOVERY'),
      evidence('dtc', 'OBD_STORED_DTC_SCAN'),
      evidence('readiness', 'OBD_MONITOR_STATUS_PID01'),
      evidence('idle', 'LIVE_OBD_TELEMETRY_WINDOW', { captureContext: CaptureContext.IDLE }),
    ], '2026-08-27T11:00:00.000Z');

    expect(result.coverage.overallLevel).toBe(CoverageLevel.PARTIAL);
    expect(result.limitations.some(item => item.includes('Controlled road telemetry window'))).toBe(true);
  });
});
