import { and, desc, eq } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { StoredVehicleCheckReport } from '../../../../application/check/VehicleCheckReport';
import * as schema from '../schema';
import { vehicleCheckReports } from '../schema/checks';

type Db = ExpoSQLiteDatabase<typeof schema>;

export class VehicleCheckReportRepository {
  constructor(private db: Db) {}

  async getBySession(workspaceId: string, sessionId: string): Promise<StoredVehicleCheckReport | null> {
    const rows = await this.db.select().from(vehicleCheckReports).where(and(
      eq(vehicleCheckReports.workspaceId, workspaceId),
      eq(vehicleCheckReports.sessionId, sessionId),
    )).limit(1);
    return (rows[0] as StoredVehicleCheckReport | undefined) ?? null;
  }

  async getRecent(workspaceId: string, limit: number = 30): Promise<StoredVehicleCheckReport[]> {
    const rows = await this.db.select().from(vehicleCheckReports)
      .where(eq(vehicleCheckReports.workspaceId, workspaceId))
      .orderBy(desc(vehicleCheckReports.generatedAt))
      .limit(limit);
    return rows as StoredVehicleCheckReport[];
  }

  async saveImmutable(report: StoredVehicleCheckReport): Promise<StoredVehicleCheckReport> {
    const existing = await this.getBySession(report.workspaceId, report.sessionId);
    if (existing) {
      if (existing.sha256 !== report.sha256 || existing.canonicalJson !== report.canonicalJson) {
        throw new Error('IMMUTABLE_VEHICLE_CHECK_CONFLICT');
      }
      return existing;
    }

    await this.db.insert(vehicleCheckReports).values({
      id: report.id,
      workspaceId: report.workspaceId,
      vehicleId: report.vehicleId,
      sessionId: report.sessionId,
      schemaVersion: report.schemaVersion,
      state: 'FINAL',
      snapshotJson: report.snapshotJson,
      canonicalJson: report.canonicalJson,
      sha256: report.sha256,
      generatedAt: report.generatedAt,
      createdAt: report.createdAt,
    });
    return report;
  }
}
