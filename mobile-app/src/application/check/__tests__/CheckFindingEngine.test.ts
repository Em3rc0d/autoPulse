import {
  ConfidenceLevel,
  EvidenceOrigin,
  EvidenceState,
  EvaluationState,
  FindingSeverity,
  FindingSource,
  FindingStatus,
} from '../../../domain/evaluation/models/enums';
import { Evaluation } from '../../../domain/evaluation/models/evaluation';
import { EvidenceItem } from '../../../domain/evaluation/models/evidenceItem';
import { Finding } from '../../../domain/evaluation/models/finding';
import {
  createEvaluationId,
  createEvidenceItemId,
  createFindingId,
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';
import { StoredAutoPulseCheck } from '../AutoPulseCheckEngine';
import {
  CheckFindingEngine,
  CheckFindingEvaluationSource,
  CheckFindingEvidenceSource,
  CheckFindingStore,
} from '../CheckFindingEngine';

class MemoryEvaluationSource implements CheckFindingEvaluationSource {
  check: StoredAutoPulseCheck | null = null;
  async getEvaluation() { return this.check; }
}

class MemoryEvidenceSource implements CheckFindingEvidenceSource {
  evidence: EvidenceItem[] = [];
  async listEvidence() { return this.evidence; }
}

class MemoryFindingStore implements CheckFindingStore {
  findings: Finding[] = [];
  async getFinding(id: string) { return this.findings.find(item => item.id === id) ?? null; }
  async listFindings() { return this.findings; }
  async saveFinding(finding: Finding) {
    const index = this.findings.findIndex(item => item.id === finding.id);
    if (index >= 0) this.findings[index] = finding;
    else this.findings.push(finding);
  }
}

const evaluationId = createEvaluationId('evaluation-1');
const technicianId = createTechnicianId('tech-1');

function evaluation(state: EvaluationState): Evaluation {
  return {
    id: evaluationId,
    tenantId: createTenantId('tenant-1'),
    vehicleId: createVehicleId('vehicle-1'),
    technicianId,
    state,
    scope: { requestedItems: [] },
    limitations: 'Electronic coverage is limited to captured evidence.',
    createdAt: parseUtcIsoTimestamp('2026-08-27T10:00:00Z'),
  };
}

function storedCheck(state: EvaluationState): StoredAutoPulseCheck {
  return {
    evaluation: evaluation(state),
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
}

function evidence(
  id: string,
  type: string,
  metadata: Record<string, unknown>,
): EvidenceItem {
  return {
    id: createEvidenceItemId(id),
    evaluationId,
    origin: EvidenceOrigin.OBD_CAPTURE,
    type,
    state: EvidenceState.COMMITTED,
    capturedAt: parseUtcIsoTimestamp('2026-08-27T10:05:00Z'),
    metadata,
  };
}

describe('CheckFindingEngine', () => {
  let evaluations: MemoryEvaluationSource;
  let evidenceSource: MemoryEvidenceSource;
  let findingStore: MemoryFindingStore;
  let findingSeq: number;
  let engine: CheckFindingEngine;

  beforeEach(() => {
    evaluations = new MemoryEvaluationSource();
    evaluations.check = storedCheck(EvaluationState.EVIDENCE_COLLECTION);
    evidenceSource = new MemoryEvidenceSource();
    findingStore = new MemoryFindingStore();
    findingSeq = 0;
    engine = new CheckFindingEngine(
      evaluations,
      evidenceSource,
      findingStore,
      { nextFindingId: () => createFindingId(`finding-${++findingSeq}`) },
      () => parseUtcIsoTimestamp('2026-08-27T11:00:00Z'),
    );
  });

  it('proposes an evidence-bound SYSTEM_RULE finding when stored DTCs are actually observed', async () => {
    evidenceSource.evidence = [evidence('dtc-evidence', 'OBD_STORED_DTC_SCAN', {
      executionStatus: 'SUCCESS',
      diagnosticCodes: ['P0302'],
    })];

    const result = await engine.generateSystemProposals(evaluationId);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0].source).toBe(FindingSource.SYSTEM_RULE);
    expect(result.value[0].status).toBe(FindingStatus.PROPOSED);
    expect(result.value[0].evidenceIds).toEqual([createEvidenceItemId('dtc-evidence')]);
    expect(result.value[0].systemProposal?.ruleId).toBe('CHECK_STORED_DTC_PRESENT');
  });

  it('does not create a healthy finding from NO_DATA or an empty DTC list', async () => {
    evidenceSource.evidence = [
      evidence('no-data', 'OBD_STORED_DTC_SCAN', {
        executionStatus: 'NO_DATA',
        diagnosticCodes: [],
      }),
      evidence('empty-success', 'OBD_STORED_DTC_SCAN', {
        executionStatus: 'SUCCESS',
        diagnosticCodes: [],
      }),
    ];

    const result = await engine.generateSystemProposals(evaluationId);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.value).toEqual([]);
    expect(findingStore.findings).toEqual([]);
  });

  it('proposes MIL evidence only when the MIL is actually ON', async () => {
    evidenceSource.evidence = [evidence('monitor-off', 'OBD_MONITOR_STATUS_PID01', {
      executionStatus: 'SUCCESS',
      monitorStatus: { milOn: false, confirmedDtcCount: 0 },
    })];

    const first = await engine.generateSystemProposals(evaluationId);
    expect(first.ok).toBe(true);
    if (first.ok === false) return;
    expect(first.value).toHaveLength(0);

    evidenceSource.evidence.push(evidence('monitor-on', 'OBD_MONITOR_STATUS_PID01', {
      executionStatus: 'SUCCESS',
      monitorStatus: { milOn: true, confirmedDtcCount: 1 },
    }));
    const second = await engine.generateSystemProposals(evaluationId);
    expect(second.ok).toBe(true);
    if (second.ok === false) return;
    expect(second.value).toHaveLength(1);
    expect(second.value[0].systemProposal?.ruleId).toBe('CHECK_MIL_ON');
  });

  it('proposes freeze-frame context only when an actual trigger exists', async () => {
    evidenceSource.evidence = [
      evidence('freeze-none', 'OBD_FREEZE_FRAME_TRIGGER', {
        executionStatus: 'NO_DATA',
        freezeFrameTrigger: null,
      }),
      evidence('freeze-present', 'OBD_FREEZE_FRAME_TRIGGER', {
        executionStatus: 'SUCCESS',
        freezeFrameTrigger: { frameNumber: 0, triggerDtc: 'P0302' },
      }),
    ];

    const result = await engine.generateSystemProposals(evaluationId);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].systemProposal?.ruleId).toBe('CHECK_FREEZE_FRAME_TRIGGER_PRESENT');
  });

  it('is idempotent for the same rule and evidence item', async () => {
    evidenceSource.evidence = [evidence('dtc-evidence', 'OBD_STORED_DTC_SCAN', {
      executionStatus: 'SUCCESS',
      diagnosticCodes: ['P0302'],
    })];

    const first = await engine.generateSystemProposals(evaluationId);
    const second = await engine.generateSystemProposals(evaluationId);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok === false) return;
    expect(second.value).toHaveLength(0);
    expect(findingStore.findings).toHaveLength(1);
  });

  it('refuses professional review before the evaluation enters IN_REVIEW', async () => {
    evidenceSource.evidence = [evidence('dtc-evidence', 'OBD_STORED_DTC_SCAN', {
      executionStatus: 'SUCCESS',
      diagnosticCodes: ['P0302'],
    })];
    await engine.generateSystemProposals(evaluationId);

    const result = await engine.reviewFinding({
      evaluationId,
      findingId: createFindingId('finding-1'),
      technicianId,
      finalStatus: FindingStatus.CONFIRMED,
      finalSeverity: FindingSeverity.ATENCION_REQUERIDA,
      finalConfidence: ConfidenceLevel.HIGH,
    });
    expect(result.ok).toBe(false);
  });

  it('attaches technician review and preserves accountability for confirmed/rejected/inconclusive outcomes', async () => {
    evaluations.check = storedCheck(EvaluationState.IN_REVIEW);
    findingStore.findings = [{
      id: createFindingId('finding-1'),
      evaluationId,
      source: FindingSource.SYSTEM_RULE,
      status: FindingStatus.PROPOSED,
      severity: FindingSeverity.ATENCION_REQUERIDA,
      confidence: ConfidenceLevel.HIGH,
      evidenceIds: [createEvidenceItemId('dtc-evidence')],
    }];

    const result = await engine.reviewFinding({
      evaluationId,
      findingId: createFindingId('finding-1'),
      technicianId,
      finalStatus: FindingStatus.INCONCLUSIVE,
      finalSeverity: FindingSeverity.PREVENTIVO,
      finalConfidence: ConfidenceLevel.MEDIUM,
      comment: 'Requires mechanical correlation.',
      justification: 'DTC evidence exists but root cause is not established.',
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.value.status).toBe(FindingStatus.INCONCLUSIVE);
    expect(result.value.professionalReview?.technicianId).toBe(technicianId);
    expect(result.value.professionalReview?.comment).toBe('Requires mechanical correlation.');
  });

  it('marks a materially modified system proposal as HYBRID', async () => {
    evaluations.check = storedCheck(EvaluationState.IN_REVIEW);
    findingStore.findings = [{
      id: createFindingId('finding-1'),
      evaluationId,
      source: FindingSource.SYSTEM_RULE,
      status: FindingStatus.PROPOSED,
      severity: FindingSeverity.ATENCION_REQUERIDA,
      confidence: ConfidenceLevel.HIGH,
      evidenceIds: [createEvidenceItemId('dtc-evidence')],
    }];

    const result = await engine.reviewFinding({
      evaluationId,
      findingId: createFindingId('finding-1'),
      technicianId,
      finalStatus: FindingStatus.MODIFIED,
      finalSeverity: FindingSeverity.PREVENTIVO,
      finalConfidence: ConfidenceLevel.MEDIUM,
      justification: 'Professional review reduced severity after supporting context.',
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.value.source).toBe(FindingSource.HYBRID);
    expect(result.value.status).toBe(FindingStatus.MODIFIED);
  });
});
