import { asc, eq } from 'drizzle-orm';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { Finding } from '../../../../domain/evaluation/models/finding';
import {
  ConfidenceLevel,
  FindingSeverity,
  FindingSource,
  FindingStatus,
} from '../../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
  createFindingId,
  createTechnicianId,
} from '../../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../../domain/shared/timestamps';
import * as schema from '../schema';

function hydrateFinding(row: typeof schema.checkFindings.$inferSelect): Finding {
  const systemProposalRaw = row.systemProposalJson ? JSON.parse(row.systemProposalJson) : undefined;
  const professionalReviewRaw = row.professionalReviewJson ? JSON.parse(row.professionalReviewJson) : undefined;

  return {
    id: createFindingId(row.id),
    evaluationId: createEvaluationId(row.evaluationId),
    source: row.source as FindingSource,
    status: row.status as FindingStatus,
    severity: row.severity as FindingSeverity,
    confidence: row.confidence as ConfidenceLevel,
    evidenceIds: (JSON.parse(row.evidenceIdsJson) as string[]).map(createEvidenceItemId),
    systemProposal: systemProposalRaw ? {
      ...systemProposalRaw,
      proposedSeverity: systemProposalRaw.proposedSeverity as FindingSeverity,
      proposedConfidence: systemProposalRaw.proposedConfidence as ConfidenceLevel,
      usedEvidenceIds: (systemProposalRaw.usedEvidenceIds ?? []).map(createEvidenceItemId),
    } : undefined,
    professionalReview: professionalReviewRaw ? {
      ...professionalReviewRaw,
      technicianId: createTechnicianId(professionalReviewRaw.technicianId),
      finalStatus: professionalReviewRaw.finalStatus as FindingStatus,
      finalSeverity: professionalReviewRaw.finalSeverity as FindingSeverity,
      finalConfidence: professionalReviewRaw.finalConfidence as ConfidenceLevel,
      reviewedAt: parseUtcIsoTimestamp(professionalReviewRaw.reviewedAt),
    } : undefined,
    technicalExplanation: row.technicalExplanation ?? undefined,
    clientExplanation: row.clientExplanation ?? undefined,
    suggestedAction: row.suggestedAction ?? undefined,
    limitations: row.limitations ?? undefined,
  };
}

export class CheckFindingRepository {
  constructor(private readonly db: ExpoSQLiteDatabase<typeof schema>) {}

  async saveFinding(finding: Finding): Promise<void> {
    const values = {
      id: finding.id,
      evaluationId: finding.evaluationId,
      source: finding.source,
      status: finding.status,
      severity: finding.severity,
      confidence: finding.confidence,
      evidenceIdsJson: JSON.stringify(finding.evidenceIds),
      systemProposalJson: finding.systemProposal ? JSON.stringify(finding.systemProposal) : null,
      professionalReviewJson: finding.professionalReview ? JSON.stringify(finding.professionalReview) : null,
      technicalExplanation: finding.technicalExplanation ?? null,
      clientExplanation: finding.clientExplanation ?? null,
      suggestedAction: finding.suggestedAction ?? null,
      limitations: finding.limitations ?? null,
      updatedAt: Date.now(),
    } as any;

    const existing = await this.db.query.checkFindings.findFirst({
      where: eq(schema.checkFindings.id, finding.id),
    });

    if (existing) {
      await this.db.update(schema.checkFindings)
        .set(values)
        .where(eq(schema.checkFindings.id, finding.id));
      return;
    }

    await this.db.insert(schema.checkFindings).values({
      ...values,
      createdAt: Date.now(),
    });
  }

  async getFinding(findingId: string): Promise<Finding | null> {
    const row = await this.db.query.checkFindings.findFirst({
      where: eq(schema.checkFindings.id, findingId),
    });
    return row ? hydrateFinding(row) : null;
  }

  async listFindings(evaluationId: string): Promise<Finding[]> {
    const rows = await this.db.query.checkFindings.findMany({
      where: eq(schema.checkFindings.evaluationId, evaluationId),
      orderBy: [asc(schema.checkFindings.createdAt)],
    });
    return rows.map(hydrateFinding);
  }
}
