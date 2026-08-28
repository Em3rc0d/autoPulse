import { VehicleCheckReportService } from '../VehicleCheckReportService';
import { sealVehicleCheckSnapshot } from '../VehicleCheckIntegrity';
import type { StoredVehicleCheckReport, VehicleCheckSnapshot } from '../VehicleCheckReport';

function snapshot(overrides: Partial<VehicleCheckSnapshot> = {}): VehicleCheckSnapshot {
  return {
    schema: 'autopulse.vehicle-check/v1',
    checkId: 'check-restore-1',
    generatedAt: 1,
    workspaceId: 'workspace-1',
    sessionId: 'session-1',
    vehicle: { vehicleId: 'vehicle-1', make: 'Renault', model: 'Duster', year: 2014 },
    acquisition: { mode: 'REAL_BLE', adapterId: 'adapter-1', protocolId: 'A0', startedAt: '2026-08-28T10:00:00.000Z' },
    evidence: {
      sessionIntegrity: 'COMPLETE', interrupted: false,
      expectedBlocksCount: 1, foundBlocksCount: 1, corruptedBlocksCount: 0,
      gapsDetectedCount: 0, totalEventsCount: 3, totalReadingsCount: 3,
    },
    compatibility: {
      available: true, protocol: 'A0', standardObdReachable: true,
      discoveredEcuCount: 1, enhancedDiagnosticsAdvertised: null, enhancedDiagnosticsProbed: null,
    },
    signals: [],
    coverage: { targetSignals: 5, observedSignals: 0, probedNoDataSignals: 0, invalidOnlySignals: 0, notEvaluatedSignals: 5, observedPercent: 0 },
    limitations: ['bounded V1'],
    pilotEligible: true,
    ...overrides,
  };
}

async function storedReport(): Promise<StoredVehicleCheckReport> {
  const report = snapshot();
  const sealed = await sealVehicleCheckSnapshot(report);
  return {
    id: report.checkId,
    workspaceId: report.workspaceId,
    vehicleId: report.vehicle.vehicleId,
    sessionId: report.sessionId,
    schemaVersion: report.schema,
    snapshotJson: JSON.stringify(report),
    canonicalJson: sealed.canonicalJson,
    sha256: sealed.sha256,
    generatedAt: report.generatedAt,
    createdAt: 2,
  };
}

function serviceWith(existing: StoredVehicleCheckReport) {
  const repository = {
    getBySession: jest.fn().mockResolvedValue(existing),
    saveImmutable: jest.fn(),
  };
  return {
    service: new VehicleCheckReportService(repository as any),
    repository,
  };
}

const input = {
  summary: { workspaceId: 'workspace-1', sessionId: 'session-1' } as any,
  vehicle: { vehicleId: 'vehicle-1' },
};

describe('VehicleCheckReportService persisted integrity', () => {
  it('restores an immutable persisted report only after verifying its seal', async () => {
    const existing = await storedReport();
    const { service, repository } = serviceWith(existing);

    await expect(service.getOrCreate(input)).resolves.toMatchObject({
      sha256: existing.sha256,
      verified: true,
      reusedExisting: true,
    });
    expect(repository.saveImmutable).not.toHaveBeenCalled();
  });

  it('fails closed when persisted snapshot JSON no longer matches canonical JSON and SHA-256', async () => {
    const existing = await storedReport();
    const original = snapshot();
    const corrupted = snapshot({ vehicle: { ...original.vehicle, model: 'Logan' } });
    const tampered: StoredVehicleCheckReport = {
      ...existing,
      snapshotJson: JSON.stringify(corrupted),
    };
    const { service, repository } = serviceWith(tampered);

    await expect(service.getOrCreate(input)).rejects.toThrow('VEHICLE_CHECK_INTEGRITY_MISMATCH');
    expect(repository.saveImmutable).not.toHaveBeenCalled();
  });
});
