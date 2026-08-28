import {
  SessionAcquisitionMode,
  SessionIntegrityState,
  SessionSummaryResult,
} from '../../../domain/telemetry/models/sessionSummaryResult';
import { CoverageLevel } from '../../../domain/evaluation/models/enums';
import {
  buildCheckLiteAssessment,
  RequestedCheckSignal,
} from '../CheckLiteAssessmentBuilder';

const requestedSignals: readonly RequestedCheckSignal[] = [
  { signalId: 'ENGINE_RPM', description: 'Engine RPM', isMandatory: true, origin: 'ECU' },
  { signalId: 'ENGINE_COOLANT', description: 'Engine coolant', isMandatory: true, origin: 'ECU' },
  { signalId: 'VEHICLE_SPEED', description: 'Vehicle speed', isMandatory: true, origin: 'ECU' },
  { signalId: 'CONTROL_VOLTAGE', description: 'ECU control-module voltage', isMandatory: false, origin: 'ECU' },
];

function summary(overrides: Record<string, unknown> = {}): SessionSummaryResult {
  return {
    sessionId: 'session-1',
    vehicleId: 'vehicle-1',
    workspaceId: 'workspace-1',
    acquisitionMode: SessionAcquisitionMode.REAL_BLE,
    startedAt: '2026-08-27T20:00:00.000Z',
    endedAt: '2026-08-27T20:10:00.000Z',
    isInterrupted: false,
    expectedBlocksCount: 10,
    foundBlocksCount: 10,
    completeBlocksCount: 10,
    partialBlocksCount: 0,
    corruptedBlocksCount: 0,
    unsupportedBlocksCount: 0,
    gapsDetectedCount: 0,
    totalEventsCount: 100,
    totalReadingsCount: 90,
    integrityState: SessionIntegrityState.COMPLETE,
    signalSummaries: {
      ENGINE_RPM: {
        signalId: 'ENGINE_RPM', validReadingsCount: 30, noDataCount: 0, invalidCount: 0,
        min: 924, max: 1955, avg: 1300, firstValidAt: '2026-08-27T20:00:10.000Z', lastValidAt: '2026-08-27T20:09:50.000Z',
      },
      ENGINE_COOLANT: {
        signalId: 'ENGINE_COOLANT', validReadingsCount: 30, noDataCount: 0, invalidCount: 0,
        min: 78, max: 84, avg: 81, firstValidAt: '2026-08-27T20:00:10.000Z', lastValidAt: '2026-08-27T20:09:50.000Z',
      },
      VEHICLE_SPEED: {
        signalId: 'VEHICLE_SPEED', validReadingsCount: 30, noDataCount: 0, invalidCount: 0,
        min: 0, max: 24, avg: 11, firstValidAt: '2026-08-27T20:00:10.000Z', lastValidAt: '2026-08-27T20:09:50.000Z',
      },
      CONTROL_VOLTAGE: {
        signalId: 'CONTROL_VOLTAGE', validReadingsCount: 0, noDataCount: 3, invalidCount: 0,
        min: null, max: null, avg: null, firstValidAt: null, lastValidAt: null,
      },
    },
    ...overrides,
  } as unknown as SessionSummaryResult;
}

describe('CheckLiteAssessmentBuilder', () => {
  it('keeps NO_DATA as a covered acquisition outcome without inventing a failure', () => {
    const assessment = buildCheckLiteAssessment(summary(), requestedSignals);
    const voltage = assessment.observations.find(item => item.signalId === 'CONTROL_VOLTAGE');

    expect(voltage?.state).toBe('NO_DATA');
    expect(assessment.coverage.overallLevel).toBe(CoverageLevel.HIGH);
    expect(assessment.limitations.join(' ')).toContain('not a vehicle failure conclusion');
    expect(assessment.canAdvanceToProfessionalReview).toBe(true);
  });

  it('marks missing mandatory evidence as not covered rather than unsupported', () => {
    const source = summary();
    const assessment = buildCheckLiteAssessment({
      ...source,
      signalSummaries: {
        ...source.signalSummaries,
        ENGINE_COOLANT: undefined,
      },
    } as unknown as SessionSummaryResult, requestedSignals);

    const coolant = assessment.observations.find(item => item.signalId === 'ENGINE_COOLANT');
    expect(coolant?.state).toBe('NO_EVIDENCE');
    expect(assessment.coverage.overallLevel).toBe(CoverageLevel.PARTIAL);
    expect(assessment.limitations.join(' ')).toContain('mandatory requested item was not evaluated');
  });

  it('does not promote replay or preview data as physical vehicle evidence', () => {
    const assessment = buildCheckLiteAssessment(
      summary({ acquisitionMode: SessionAcquisitionMode.LAPTOP_REPLAY }),
      requestedSignals,
    );

    expect(assessment.canAdvanceToProfessionalReview).toBe(false);
    expect(assessment.limitations.join(' ')).toContain('not physical vehicle evidence');
  });

  it('blocks corrupted source sessions from professional-review readiness', () => {
    const assessment = buildCheckLiteAssessment(
      summary({ integrityState: SessionIntegrityState.CORRUPTED }),
      requestedSignals,
    );

    expect(assessment.canAdvanceToProfessionalReview).toBe(false);
    expect(assessment.limitations.join(' ')).toContain('CORRUPTED');
  });

  it('preserves invalid-only data without claiming a valid reading', () => {
    const source = summary();
    const assessment = buildCheckLiteAssessment({
      ...source,
      signalSummaries: {
        ...source.signalSummaries,
        ENGINE_COOLANT: {
          signalId: 'ENGINE_COOLANT', validReadingsCount: 0, noDataCount: 0, invalidCount: 4,
          min: null, max: null, avg: null, firstValidAt: null, lastValidAt: null,
        },
      },
    } as unknown as SessionSummaryResult, requestedSignals);

    const coolant = assessment.observations.find(item => item.signalId === 'ENGINE_COOLANT');
    expect(coolant?.state).toBe('INVALID_ONLY');
    expect(coolant?.min).toBeNull();
    expect(assessment.limitations.join(' ')).toContain('only invalid readings were retained');
  });
});
