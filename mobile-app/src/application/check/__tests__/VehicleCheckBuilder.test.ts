import { buildVehicleCheckSnapshot } from '../VehicleCheckBuilder';
import { SessionAcquisitionMode, SessionIntegrityState, type SessionSummaryResult } from '../../../domain/telemetry/models/sessionSummaryResult';

function summary(overrides: Partial<SessionSummaryResult> = {}): SessionSummaryResult {
  return {
    sessionId: 'session-1' as any,
    vehicleId: 'vehicle-1' as any,
    workspaceId: 'workspace-1' as any,
    acquisitionMode: SessionAcquisitionMode.REAL_BLE,
    adapterId: 'adapter-1',
    protocolId: 'A0',
    startedAt: '2026-08-28T10:00:00.000Z' as any,
    endedAt: '2026-08-28T10:01:00.000Z' as any,
    durationSeconds: 60,
    isInterrupted: false,
    expectedBlocksCount: 1,
    foundBlocksCount: 1,
    completeBlocksCount: 1,
    partialBlocksCount: 0,
    corruptedBlocksCount: 0,
    unsupportedBlocksCount: 0,
    gapsDetectedCount: 0,
    totalEventsCount: 4,
    totalReadingsCount: 3,
    integrityState: SessionIntegrityState.COMPLETE,
    signalSummaries: {},
    ...overrides,
  };
}

describe('VehicleCheckBuilder', () => {
  it('never converts missing signals into zero-valued observations', () => {
    const check = buildVehicleCheckSnapshot({
      checkId: 'check-1',
      generatedAt: 1,
      summary: summary(),
      vehicle: { vehicleId: 'vehicle-1' },
      compatibility: null,
    });
    expect(check.signals.every(item => item.state === 'NOT_EVALUATED')).toBe(true);
    expect(check.signals.every(item => item.min === null && item.avg === null && item.max === null)).toBe(true);
    expect(check.coverage.observedPercent).toBe(0);
  });

  it('keeps adapter voltage separate from ECU control-module voltage', () => {
    const check = buildVehicleCheckSnapshot({
      checkId: 'check-1',
      generatedAt: 1,
      summary: summary({
        signalSummaries: {
          ADAPTER_VOLTAGE: {
            signalId: 'ADAPTER_VOLTAGE', validReadingsCount: 2, noDataCount: 0, invalidCount: 0,
            min: 14.1, avg: 14.2, max: 14.3, firstValidAt: null, lastValidAt: null,
          },
        },
      }),
      vehicle: { vehicleId: 'vehicle-1' },
      compatibility: null,
    });
    expect(check.signals.find(item => item.key === 'ADAPTER_VOLTAGE')?.state).toBe('OBSERVED');
    expect(check.signals.find(item => item.key === 'ECU_VOLTAGE')?.state).toBe('NOT_EVALUATED');
    expect(check.limitations.some(item => item.includes('not substituted'))).toBe(true);
  });

  it('marks an incomplete session as not eligible for the customer pilot', () => {
    const check = buildVehicleCheckSnapshot({
      checkId: 'check-1',
      generatedAt: 1,
      summary: summary({ integrityState: SessionIntegrityState.PARTIAL }),
      vehicle: { vehicleId: 'vehicle-1' },
      compatibility: null,
    });
    expect(check.pilotEligible).toBe(false);
    expect(check.limitations.some(item => item.includes('PARTIAL'))).toBe(true);
  });
});
