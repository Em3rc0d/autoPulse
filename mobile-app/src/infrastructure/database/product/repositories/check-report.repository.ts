import { desc, eq } from 'drizzle-orm';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { ReportDraft } from '../../../../domain/evaluation/models/reportDraft';
import { ReportManifest } from '../../../../domain/evaluation/models/reportManifest';
import { ReportVersion } from '../../../../domain/evaluation/models/reportVersion';
import { ReportDraftState, ReportVersionState } from '../../../../domain/evaluation/models/enums';
import {
  ManifestId,
  createEvaluationId,
  createManifestId,
  createReportDraftId,
  createReportVersionId,
  createTechnicianId,
} from '../../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../../domain/shared/timestamps';
import * as schema from '../schema';

export interface StoredCheckReportManifest {
  readonly manifest: ReportManifest;
  readonly canonicalPayload: string;
  readonly integrityHash: string;
}

export class CheckReportRepository {
  constructor(private readonly db: ExpoSQLiteDatabase<typeof schema>) {}

  async saveDraft(draft: ReportDraft): Promise<void> {
    const values = {
      id: draft.id,
      evaluationId: draft.evaluationId,
      state: draft.state,
      visibleFindingIdsJson: JSON.stringify(draft.visibleFindingIds),
      selectedEvidenceIdsJson: JSON.stringify(draft.selectedEvidenceIds),
      customRecommendations: draft.customRecommendations ?? null,
      draftNotes: draft.draftNotes ?? null,
      updatedAt: Date.now(),
    } as any;
    const existing = await this.db.query.checkReportDrafts.findFirst({
      where: eq(schema.checkReportDrafts.id, draft.id),
    });
    if (existing) {
      await this.db.update(schema.checkReportDrafts).set(values).where(eq(schema.checkReportDrafts.id, draft.id));
      return;
    }
    await this.db.insert(schema.checkReportDrafts).values({ ...values, createdAt: Date.now() });
  }

  async getLatestDraft(evaluationId: string): Promise<ReportDraft | null> {
    const row = await this.db.query.checkReportDrafts.findFirst({
      where: eq(schema.checkReportDrafts.evaluationId, evaluationId),
      orderBy: [desc(schema.checkReportDrafts.updatedAt)],
    });
    if (!row) return null;
    return {
      id: createReportDraftId(row.id),
      evaluationId: createEvaluationId(row.evaluationId),
      state: row.state as ReportDraftState,
      visibleFindingIds: JSON.parse(row.visibleFindingIdsJson),
      selectedEvidenceIds: JSON.parse(row.selectedEvidenceIdsJson),
      customRecommendations: row.customRecommendations ?? undefined,
      draftNotes: row.draftNotes ?? undefined,
    };
  }

  async saveManifest(
    evaluationId: string,
    manifest: ReportManifest,
    canonicalPayload: string,
    integrityHash: string,
  ): Promise<void> {
    await this.db.insert(schema.checkReportManifests).values({
      id: manifest.id,
      evaluationId,
      manifestJson: JSON.stringify(manifest),
      canonicalPayload,
      integrityHash,
      generatedAt: new Date(manifest.generatedAt).getTime(),
    } as any);
  }

  async getManifest(id: ManifestId): Promise<StoredCheckReportManifest | null> {
    const row = await this.db.query.checkReportManifests.findFirst({
      where: eq(schema.checkReportManifests.id, id),
    });
    if (!row) return null;
    return {
      manifest: JSON.parse(row.manifestJson) as ReportManifest,
      canonicalPayload: row.canonicalPayload,
      integrityHash: row.integrityHash,
    };
  }

  async saveVersion(version: ReportVersion): Promise<void> {
    await this.db.insert(schema.checkReportVersions).values({
      id: version.id,
      evaluationId: version.evaluationId,
      versionNumber: version.versionNumber,
      state: version.state,
      manifestId: version.manifestId,
      integrityHash: version.integrityHash,
      signedBy: version.signedBy,
      signedAt: new Date(version.signedAt).getTime(),
      supersedesVersionId: version.supersedesVersionId ?? null,
      voidReason: version.voidReason ?? null,
      createdAt: Date.now(),
    } as any);
  }

  async getLatestVersion(evaluationId: string): Promise<ReportVersion | null> {
    const row = await this.db.query.checkReportVersions.findFirst({
      where: eq(schema.checkReportVersions.evaluationId, evaluationId),
      orderBy: [desc(schema.checkReportVersions.versionNumber)],
    });
    if (!row) return null;
    return {
      id: createReportVersionId(row.id),
      evaluationId: createEvaluationId(row.evaluationId),
      versionNumber: row.versionNumber,
      state: row.state as ReportVersionState,
      manifestId: createManifestId(row.manifestId),
      integrityHash: row.integrityHash,
      signedBy: createTechnicianId(row.signedBy),
      signedAt: parseUtcIsoTimestamp(new Date(row.signedAt).toISOString()),
      supersedesVersionId: row.supersedesVersionId ? createReportVersionId(row.supersedesVersionId) : undefined,
      voidReason: row.voidReason ?? undefined,
    };
  }
}
