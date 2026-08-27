import { and, desc, eq } from 'drizzle-orm';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import {
  AutoPulseCheckStore,
  StoredAutoPulseCheck,
} from '../../../../application/check/AutoPulseCheckEngine';
import { AutoPulseCheckPurpose } from '../../../../application/check/AutoPulseCheckPlan';
import { Evaluation } from '../../../../domain/evaluation/models/evaluation';
import { EvidenceItem } from '../../../../domain/evaluation/models/evidenceItem';
import {
  EvidenceOrigin,
  EvidenceState,
  EvaluationState,
} from '../../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
  createLiveSessionId,
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../../domain/shared/timestamps';
import * as schema from '../schema';

function toMs(value: string | undefined): number | null {
  return value ? new Date(value).getTime() : null;
}

function fromMs(value: number | null | undefined) {
  return value === null || value === undefined
    ? undefined
    : parseUtcIsoTimestamp(new Date(value).toISOString());
}

export class CheckEvaluationRepository implements AutoPulseCheckStore {
  constructor(private readonly db: ExpoSQLiteDatabase<typeof schema>) {}

  async getEvaluation(id: ReturnType<typeof createEvaluationId>): Promise<StoredAutoPulseCheck | null> {
    const row = await this.db.query.checkEvaluations.findFirst({
      where: eq(schema.checkEvaluations.id, id),
    });
    if (!row) return null;

    const evaluation: Evaluation = {
      id: createEvaluationId(row.id),
      tenantId: createTenantId(row.workspaceId),
      vehicleId: createVehicleId(row.vehicleId),
      technicianId: createTechnicianId(row.operatorId),
      state: row.state as EvaluationState,
      scope: JSON.parse(row.scopeJson),
      limitations: row.limitations ?? undefined,
      symptoms: row.symptoms ?? undefined,
      createdAt: parseUtcIsoTimestamp(new Date(row.createdAt).toISOString()),
      openedAt: fromMs(row.openedAt),
      signedAt: fromMs(row.signedAt),
      cancelledAt: fromMs(row.cancelledAt),
    };

    return {
      evaluation,
      purpose: row.purpose as AutoPulseCheckPurpose,
    };
  }

  async saveEvaluation(check: StoredAutoPulseCheck): Promise<void> {
    const { evaluation, purpose } = check;
    const values = {
      id: evaluation.id,
      workspaceId: evaluation.tenantId,
      vehicleId: evaluation.vehicleId,
      operatorId: evaluation.technicianId,
      state: evaluation.state,
      purpose,
      scopeJson: JSON.stringify(evaluation.scope),
      limitations: evaluation.limitations ?? null,
      symptoms: evaluation.symptoms ?? null,
      createdAt: new Date(evaluation.createdAt).getTime(),
      openedAt: toMs(evaluation.openedAt),
      signedAt: toMs(evaluation.signedAt),
      cancelledAt: toMs(evaluation.cancelledAt),
      updatedAt: Date.now(),
    } as any;

    const existing = await this.db.query.checkEvaluations.findFirst({
      where: eq(schema.checkEvaluations.id, evaluation.id),
    });

    if (existing) {
      await this.db.update(schema.checkEvaluations)
        .set(values)
        .where(eq(schema.checkEvaluations.id, evaluation.id));
      return;
    }

    await this.db.insert(schema.checkEvaluations).values(values);
  }

  async appendEvidence(evidence: EvidenceItem): Promise<void> {
    await this.db.insert(schema.checkEvidenceItems).values({
      id: evidence.id,
      evaluationId: evidence.evaluationId,
      liveSessionId: evidence.liveSessionId ?? null,
      origin: evidence.origin,
      type: evidence.type,
      state: evidence.state,
      capturedAt: new Date(evidence.capturedAt).getTime(),
      contentHash: evidence.contentHash ?? null,
      localReference: evidence.localReference ?? null,
      metadataJson: evidence.metadata ? JSON.stringify(evidence.metadata) : null,
      timeWindowStartMs: evidence.timeWindow?.startMs ?? null,
      timeWindowEndMs: evidence.timeWindow?.endMs ?? null,
      createdBy: evidence.createdBy ?? null,
      createdAt: Date.now(),
    } as any);
  }

  async listForVehicle(workspaceId: string, vehicleId: string): Promise<StoredAutoPulseCheck[]> {
    const rows = await this.db.query.checkEvaluations.findMany({
      where: and(
        eq(schema.checkEvaluations.workspaceId, workspaceId),
        eq(schema.checkEvaluations.vehicleId, vehicleId),
      ),
      orderBy: [desc(schema.checkEvaluations.createdAt)],
    });

    const checks: StoredAutoPulseCheck[] = [];
    for (const row of rows) {
      const check = await this.getEvaluation(createEvaluationId(row.id));
      if (check) checks.push(check);
    }
    return checks;
  }

  async listEvidence(evaluationId: string): Promise<EvidenceItem[]> {
    const rows = await this.db.query.checkEvidenceItems.findMany({
      where: eq(schema.checkEvidenceItems.evaluationId, evaluationId),
      orderBy: [schema.checkEvidenceItems.capturedAt],
    });

    return rows.map(row => ({
      id: createEvidenceItemId(row.id),
      evaluationId: createEvaluationId(row.evaluationId),
      liveSessionId: row.liveSessionId ? createLiveSessionId(row.liveSessionId) : undefined,
      origin: row.origin as EvidenceOrigin,
      type: row.type,
      state: row.state as EvidenceState,
      capturedAt: parseUtcIsoTimestamp(new Date(row.capturedAt).toISOString()),
      contentHash: row.contentHash ?? undefined,
      localReference: row.localReference ?? undefined,
      metadata: row.metadataJson ? JSON.parse(row.metadataJson) : undefined,
      timeWindow: row.timeWindowStartMs !== null && row.timeWindowEndMs !== null
        ? { startMs: row.timeWindowStartMs, endMs: row.timeWindowEndMs }
        : undefined,
      createdBy: row.createdBy ? createTechnicianId(row.createdBy) : undefined,
    }));
  }
}
