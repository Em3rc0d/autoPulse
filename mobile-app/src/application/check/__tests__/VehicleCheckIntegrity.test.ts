import { canonicalizeVehicleCheckSnapshot, sealVehicleCheckSnapshot, verifyVehicleCheckSnapshot } from '../VehicleCheckIntegrity';
import { sha256HexUtf8 } from '../VehicleCheckSha256';
import type { VehicleCheckSnapshot } from '../VehicleCheckReport';

function snapshot(overrides: Partial<VehicleCheckSnapshot> = {}): VehicleCheckSnapshot {
  return {
    schema: 'autopulse.vehicle-check/v1',
    checkId: 'check-1',
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

describe('VehicleCheckIntegrity', () => {
  it('matches the published SHA-256 vector for abc', () => {
    expect(sha256HexUtf8('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('canonicalizes equivalent object key order to the same payload', () => {
    const base = snapshot();
    const reordered = {
      ...base,
      vehicle: { year: 2014, model: 'Duster', make: 'Renault', vehicleId: 'vehicle-1' },
    } as VehicleCheckSnapshot;
    expect(canonicalizeVehicleCheckSnapshot(base)).toBe(canonicalizeVehicleCheckSnapshot(reordered));
  });

  it('detects report mutation after sealing', async () => {
    const original = snapshot();
    const sealed = await sealVehicleCheckSnapshot(original);
    const mutated = snapshot({ vehicle: { ...original.vehicle, model: 'Logan' } });
    await expect(verifyVehicleCheckSnapshot(mutated, sealed.sha256)).resolves.toBe(false);
  });

  it('rejects non-finite numbers before sealing', () => {
    const invalid = snapshot({ generatedAt: Number.NaN });
    expect(() => canonicalizeVehicleCheckSnapshot(invalid)).toThrow('NON_FINITE_REPORT_NUMBER:$.generatedAt');
  });
});
