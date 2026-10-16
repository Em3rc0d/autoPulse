import { ProductIdGenerator } from '../../infrastructure/database/product/uuidv7';
import { DiagnosticCheckReportRepository } from '../../infrastructure/database/product/repositories/diagnostic-check-report.repository';
import {
  buildDiagnosticCheckSnapshot,
  type DiagnosticCheckSnapshot,
  type StoredDiagnosticCheckReport,
} from './DiagnosticCheckReport';
import type { CheckPhysicalPilotV4Result } from './live/CheckPhysicalPilotV4';
import type { VehicleCheckVehicleIdentity } from './VehicleCheckReport';
import { sealIntegrityPayload } from './VehicleCheckIntegrity';

export interface DiagnosticCheckReportResult {
  readonly snapshot: DiagnosticCheckSnapshot;
  readonly sha256: string;
  readonly verified: boolean;
  readonly reusedExisting: boolean;
}

export class DiagnosticCheckReportService {
  constructor(private readonly repository: DiagnosticCheckReportRepository) {}

  private async restoreAndVerify(stored: StoredDiagnosticCheckReport): Promise<DiagnosticCheckReportResult> {
    const snapshot = JSON.parse(stored.snapshotJson) as DiagnosticCheckSnapshot;
    const sealed = await sealIntegrityPayload(snapshot);
    const verified = sealed.sha256 === stored.sha256 && sealed.canonicalJson === stored.canonicalJson;
    if (!verified) throw new Error('DIAGNOSTIC_CHECK_INTEGRITY_MISMATCH');
    return { snapshot, sha256: stored.sha256, verified: true, reusedExisting: true };
  }

  async create(input: {
    readonly workspaceId: string;
    readonly vehicle: VehicleCheckVehicleIdentity;
    readonly result: CheckPhysicalPilotV4Result;
  }): Promise<DiagnosticCheckReportResult> {
    const checkId = ProductIdGenerator.generate();
    const snapshot = buildDiagnosticCheckSnapshot({
      checkId,
      workspaceId: input.workspaceId,
      vehicle: input.vehicle,
      result: input.result,
    });
    const sealed = await sealIntegrityPayload(snapshot);
    const stored: StoredDiagnosticCheckReport = {
      id: checkId,
      workspaceId: input.workspaceId,
      vehicleId: input.vehicle.vehicleId,
      schemaVersion: snapshot.schema,
      pilotVersion: snapshot.pilotVersion,
      protocol: snapshot.protocol,
      state: 'FINAL',
      snapshotJson: JSON.stringify(snapshot),
      canonicalJson: sealed.canonicalJson,
      sha256: sealed.sha256,
      generatedAt: snapshot.generatedAt,
      createdAt: Date.now(),
    };
    await this.repository.saveImmutable(stored);
    return { snapshot, sha256: sealed.sha256, verified: true, reusedExisting: false };
  }

  async load(workspaceId: string, checkId: string): Promise<DiagnosticCheckReportResult | null> {
    const stored = await this.repository.getById(workspaceId, checkId);
    return stored ? this.restoreAndVerify(stored) : null;
  }
}
