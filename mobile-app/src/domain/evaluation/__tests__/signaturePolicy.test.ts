import { validateSignatureRequirements } from '../logic/signaturePolicy';
import { Evaluation } from '../models/evaluation';
import { Finding } from '../models/finding';
import { EvidenceItem } from '../models/evidenceItem';
import { EvaluationState, FindingStatus, FindingSeverity, ConfidenceLevel, FindingSource, EvidenceState, EvidenceOrigin, CoverageLevel } from '../models/enums';
import { createEvaluationId, createTenantId, createVehicleId, createTechnicianId, createFindingId, createEvidenceItemId } from '../../shared/identifiers';
import { nowUtc } from '../../shared/timestamps';

describe('Signature Policy', () => {
  const baseEvaluation: Evaluation = {
    id: createEvaluationId('eval-1'),
    tenantId: createTenantId('t-1'),
    vehicleId: createVehicleId('v-1'),
    technicianId: createTechnicianId('tech-1'),
    state: EvaluationState.READY_FOR_SIGNATURE,
    scope: { requestedItems: [] },
    coverage: { overallLevel: CoverageLevel.HIGH, assessedItems: [], assessedAt: nowUtc() },
    limitations: 'No limitations',
    createdAt: nowUtc()
  };

  it('rejects signature if there are PROPOSED findings', () => {
    const finding: Finding = {
      id: createFindingId('f-1'),
      evaluationId: baseEvaluation.id,
      source: FindingSource.SYSTEM_RULE,
      status: FindingStatus.PROPOSED,
      severity: FindingSeverity.INFORMATIVO,
      confidence: ConfidenceLevel.HIGH,
      evidenceIds: []
    };

    const result = validateSignatureRequirements(baseEvaluation, [finding], []);
    expect(result.ok).toBe(false);
  });

  it('rejects signature if there is STAGED evidence', () => {
    const evidence: EvidenceItem = {
      id: createEvidenceItemId('e-1'),
      evaluationId: baseEvaluation.id,
      origin: EvidenceOrigin.TECHNICIAN_OBSERVATION,
      type: 'NOTE',
      state: EvidenceState.STAGED,
      capturedAt: nowUtc()
    };

    const result = validateSignatureRequirements(baseEvaluation, [], [evidence]);
    expect(result.ok).toBe(false);
  });

  it('rejects signature if coverage is NOT_ASSESSED', () => {
    const evalNoCoverage: Evaluation = {
      ...baseEvaluation,
      coverage: { overallLevel: CoverageLevel.NOT_ASSESSED, assessedItems: [], assessedAt: nowUtc() }
    };
    const result = validateSignatureRequirements(evalNoCoverage, [], []);
    expect(result.ok).toBe(false);
  });

  it('rejects signature if limitations are empty', () => {
    const evalNoLimit: Evaluation = {
      ...baseEvaluation,
      limitations: '   '
    };
    const result = validateSignatureRequirements(evalNoLimit, [], []);
    expect(result.ok).toBe(false);
  });

  it('allows signature when all requirements are met', () => {
    const finding: Finding = {
      id: createFindingId('f-1'),
      evaluationId: baseEvaluation.id,
      source: FindingSource.SYSTEM_RULE,
      status: FindingStatus.CONFIRMED,
      severity: FindingSeverity.INFORMATIVO,
      confidence: ConfidenceLevel.HIGH,
      evidenceIds: []
    };

    const evidence: EvidenceItem = {
      id: createEvidenceItemId('e-1'),
      evaluationId: baseEvaluation.id,
      origin: EvidenceOrigin.TECHNICIAN_OBSERVATION,
      type: 'NOTE',
      state: EvidenceState.COMMITTED,
      capturedAt: nowUtc()
    };

    const result = validateSignatureRequirements(baseEvaluation, [finding], [evidence]);
    expect(result.ok).toBe(true);
  });
});
