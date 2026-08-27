import { Evaluation } from '../../../domain/evaluation/models/evaluation';
import { EvidenceItem } from '../../../domain/evaluation/models/evidenceItem';
import { EvaluationState } from '../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
  createLiveSessionId,
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';
import { AutoPulseCheckEngine, AutoPulseCheckStore } from '../AutoPulseCheckEngine';

class MemoryStore implements AutoPulseCheckStore {
  evaluations = new Map<string, Evaluation>();
  evidence: EvidenceItem[] = [];

  async getEvaluation(id: any) {
    return this.evaluations.get(id) ?? null;
  }

  async saveEvaluation(evaluation: Evaluation) {
    this.evaluations.set(evaluation.id, evaluation);
  }

  async appendEvidence(evidence: EvidenceItem) {
    this.evidence.push(evidence);
  }
}

describe('AutoPulseCheckEngine', () => {
  const store = new MemoryStore();
  let evaluationSeq = 0;
  let evidenceSeq = 0;
  const engine = new AutoPulseCheckEngine(
    store,
    {
      nextEvaluationId: () => createEvaluationId(`check-${++evaluationSeq}`),
      nextEvidenceItemId: () => createEvidenceItemId(`evidence-${++evidenceSeq}`),
    },
    () => parseUtcIsoTimestamp('2026-08-26T12:00:00Z'),
  );

  beforeEach(() => {
    store.evaluations.clear();
    store.evidence = [];
  });

  it('creates a DRAFT evaluation whose scope comes from the deterministic Check plan', async () => {
    const created = await engine.createDraft({
      tenantId: createTenantId('tenant-1'),
      vehicleId: createVehicleId('vehicle-1'),
      technicianId: createTechnicianId('tech-1'),
      purpose: 'PRE_PURCHASE',
      capabilities: {
        obd: 'SUPPORTED',
        dtcRead: 'SUPPORTED',
        readiness: 'UNKNOWN',
        freezeFrame: 'UNKNOWN',
        liveTelemetry: 'SUPPORTED',
      },
    });

    expect(created.evaluation.state).toBe(EvaluationState.DRAFT);
    expect(created.evaluation.scope.requestedItems.some(item => item.id === 'DTC_SCAN')).toBe(true);
    expect(created.evaluation.scope.requestedItems.find(item => item.id === 'ROAD_TELEMETRY')?.isMandatory).toBe(true);
  });

  it('uses the existing evaluation state machine rather than bypassing it', async () => {
    const created = await engine.createDraft({
      tenantId: createTenantId('tenant-1'),
      vehicleId: createVehicleId('vehicle-1'),
      technicianId: createTechnicianId('tech-1'),
      purpose: 'PREVENTIVE',
      capabilities: {
        obd: 'SUPPORTED',
        dtcRead: 'SUPPORTED',
        readiness: 'SUPPORTED',
        freezeFrame: 'SUPPORTED',
        liveTelemetry: 'SUPPORTED',
      },
    });

    const illegal = await engine.transition(created.evaluation.id, EvaluationState.SIGNED);
    expect(illegal.ok).toBe(false);

    const opened = await engine.transition(created.evaluation.id, EvaluationState.OPEN);
    expect(opened.ok).toBe(true);
  });

  it('promotes a real Live ECU window into the same vehicle evaluation', async () => {
    const created = await engine.createDraft({
      tenantId: createTenantId('tenant-1'),
      vehicleId: createVehicleId('vehicle-1'),
      technicianId: createTechnicianId('tech-1'),
      purpose: 'PREVENTIVE',
      capabilities: {
        obd: 'SUPPORTED',
        dtcRead: 'SUPPORTED',
        readiness: 'SUPPORTED',
        freezeFrame: 'UNKNOWN',
        liveTelemetry: 'SUPPORTED',
      },
    });
    await engine.transition(created.evaluation.id, EvaluationState.OPEN);
    await engine.transition(created.evaluation.id, EvaluationState.EVIDENCE_COLLECTION);

    const promoted = await engine.promoteLiveEvidence({
      evaluationId: created.evaluation.id,
      sessionVehicleId: createVehicleId('vehicle-1'),
      liveSessionId: createLiveSessionId('live-1'),
      startMs: 10_000,
      endMs: 40_000,
      validEcuSampleCount: 30,
      totalSampleCount: 34,
      signalTypes: ['RPM', 'COOLANT'],
      connectionRecoveryCount: 1,
      telemetryGapMs: 950,
      sessionStatus: 'COMPLETED',
    });

    expect(promoted.ok).toBe(true);
    expect(store.evidence).toHaveLength(1);
    expect(store.evidence[0].metadata?.synthesizedTelemetry).toBe(false);
  });
});
