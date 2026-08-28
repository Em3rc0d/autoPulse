import type { CompatibilitySnapshot } from '../../domain/diagnostics';
import type { SessionSummaryResult } from '../../domain/telemetry/models/sessionSummaryResult';
import { VehicleCheckReportRepository } from '../../infrastructure/database/product/repositories/vehicle-check-report.repository';
import { ProductIdGenerator } from '../../infrastructure/database/product/uuidv7';
import { buildVehicleCheckSnapshot } from './VehicleCheckBuilder';
import { sealVehicleCheckSnapshot, verifyVehicleCheckSnapshot } from './VehicleCheckIntegrity';
import type { StoredVehicleCheckReport, VehicleCheckSnapshot, VehicleCheckVehicleIdentity } from './VehicleCheckReport';

export interface VehicleCheckReportResult {
  readonly snapshot: VehicleCheckSnapshot;
  readonly sha256: string;
  readonly verified: boolean;
  readonly reusedExisting: boolean;
}

export class VehicleCheckReportService {
  constructor(private repository: VehicleCheckReportRepository) {}

  private async restoreAndVerify(stored: StoredVehicleCheckReport): Promise<VehicleCheckReportResult> {
    const snapshot = JSON.parse(stored.snapshotJson) as VehicleCheckSnapshot;
    const canonical = await sealVehicleCheckSnapshot(snapshot);
    const verified = canonical.sha256 === stored.sha256 && canonical.canonicalJson === stored.canonicalJson;
    if (!verified) throw new Error('VEHICLE_CHECK_INTEGRITY_MISMATCH');
    return { snapshot, sha256: stored.sha256, verified: true, reusedExisting: true };
  }

  async getOrCreate(input: {
    summary: SessionSummaryResult;
    vehicle: VehicleCheckVehicleIdentity;
    compatibility?: CompatibilitySnapshot | null;
  }): Promise<VehicleCheckReportResult> {
    const workspaceId = String(input.summary.workspaceId);
    const sessionId = String(input.summary.sessionId);
    const existing = await this.repository.getBySession(workspaceId, sessionId);
    if (existing) return this.restoreAndVerify(existing);

    const snapshot = buildVehicleCheckSnapshot({
      checkId: ProductIdGenerator.generate(),
      summary: input.summary,
      vehicle: input.vehicle,
      compatibility: input.compatibility,
    });
    const sealed = await sealVehicleCheckSnapshot(snapshot);
    const now = Date.now();
    const stored: StoredVehicleCheckReport = {
      id: snapshot.checkId,
      workspaceId,
      vehicleId: String(input.summary.vehicleId),
      sessionId,
      schemaVersion: snapshot.schema,
      snapshotJson: JSON.stringify(snapshot),
      canonicalJson: sealed.canonicalJson,
      sha256: sealed.sha256,
      generatedAt: snapshot.generatedAt,
      createdAt: now,
    };
    await this.repository.saveImmutable(stored);
    const verified = await verifyVehicleCheckSnapshot(snapshot, sealed.sha256);
    if (!verified) throw new Error('VEHICLE_CHECK_SEAL_VERIFICATION_FAILED');
    return { snapshot, sha256: sealed.sha256, verified: true, reusedExisting: false };
  }
}
