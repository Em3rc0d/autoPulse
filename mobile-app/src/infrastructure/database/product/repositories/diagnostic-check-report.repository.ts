import { and, desc, eq } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { StoredDiagnosticCheckReport } from '../../../../application/check/DiagnosticCheckReport';
import * as schema from '../schema';
import { diagnosticCheckReports } from '../schema/checks';

type Db = ExpoSQLiteDatabase<typeof schema>;

export class DiagnosticCheckReportRepository {
  constructor(private readonly db: Db) {}

  async getById(workspaceId: string, checkId: string): Promise<StoredDiagnosticCheckReport | null> {
    const rows = await this.db.select().from(diagnosticCheckReports).where(and(
      eq(diagnosticCheckReports.workspaceId, workspaceId),
      eq(diagnosticCheckReports.id, checkId),
    )).limit(1);
    return (rows[0] as StoredDiagnosticCheckReport | undefined) ?? null;
  }

  async getRecent(workspaceId: string, limit = 30): Promise<StoredDiagnosticCheckReport[]> {
    const bounded = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = await this.db.select().from(diagnosticCheckReports)
      .where(eq(diagnosticCheckReports.workspaceId, workspaceId))
      .orderBy(desc(diagnosticCheckReports.generatedAt))
      .limit(bounded);
    return rows as StoredDiagnosticCheckReport[];
  }

  async saveImmutable(report: StoredDiagnosticCheckReport): Promise<StoredDiagnosticCheckReport> {
    const existing = await this.getById(report.workspaceId, report.id);
    if (existing) {
      if (existing.sha256 !== report.sha256 || existing.canonicalJson !== report.canonicalJson) {
        throw new Error('IMMUTABLE_DIAGNOSTIC_CHECK_CONFLICT');
      }
      return existing;
    }

    await this.db.insert(diagnosticCheckReports).values({
      id: report.id,
      workspaceId: report.workspaceId,
      vehicleId: report.vehicleId,
      schemaVersion: report.schemaVersion,
      pilotVersion: report.pilotVersion,
      protocol: report.protocol,
      state: report.state,
      snapshotJson: report.snapshotJson,
      canonicalJson: report.canonicalJson,
      sha256: report.sha256,
      generatedAt: report.generatedAt,
      createdAt: report.createdAt,
    });
    return report;
  }
}
