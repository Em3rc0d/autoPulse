import {
  SessionAcquisitionMode,
  SessionIntegrityState,
  SessionSummaryResult,
  SignalSummary,
} from '../../domain/telemetry/models/sessionSummaryResult';
import { CoverageAssessment } from '../../domain/evaluation/models/coverageAssessment';
import { calculateOverallCoverage } from '../../domain/evaluation/logic/coveragePolicy';

export type CheckSignalOrigin = 'ECU' | 'ADAPTER' | 'PHONE_SENSOR';

export interface RequestedCheckSignal {
  readonly signalId: string;
  readonly description: string;
  readonly isMandatory: boolean;
  readonly origin: CheckSignalOrigin;
}

export type CheckObservationState =
  | 'OBSERVED'
  | 'NO_DATA'
  | 'INVALID_ONLY'
  | 'NO_EVIDENCE';

export interface CheckLiteObservation {
  readonly signalId: string;
  readonly description: string;
  readonly origin: CheckSignalOrigin;
  readonly isMandatory: boolean;
  readonly state: CheckObservationState;
  readonly validReadingsCount: number;
  readonly noDataCount: number;
  readonly invalidCount: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly avg: number | null;
  readonly firstValidAt: string | null;
  readonly lastValidAt: string | null;
}

export interface CheckLiteAssessmentDraft {
  readonly sessionId: string;
  readonly vehicleId: string;
  readonly acquisitionMode: SessionAcquisitionMode;
  readonly sessionIntegrity: SessionIntegrityState;
  readonly observations: readonly CheckLiteObservation[];
  readonly coverage: CoverageAssessment;
  readonly limitations: readonly string[];
  /**
   * This only means the evidence package is coherent enough for a human/domain
   * review step. It does not mean the vehicle passed, is healthy, or can be
   * automatically signed.
   */
  readonly canAdvanceToProfessionalReview: boolean;
}

/**
 * Builds the first commercial Check slice from evidence already persisted by
 * Live. The requested scope is supplied by the caller (normally capability /
 * evaluation setup) so this builder never invents universal vehicle support.
 *
 * Coverage answers "did we evaluate / learn something about this requested
 * item?". A NO_DATA response is therefore covered evidence, but it is not an
 * OBSERVED value and never becomes a vehicle failure by itself.
 */
export function buildCheckLiteAssessment(
  summary: SessionSummaryResult,
  requestedSignals: readonly RequestedCheckSignal[],
): CheckLiteAssessmentDraft {
  const observations = requestedSignals.map(request =>
    buildObservation(request, summary.signalSummaries[request.signalId]),
  );

  const assessedItems = observations.map(observation => ({
    moduleName: observation.description,
    isCovered: observation.state !== 'NO_EVIDENCE',
    reasonIfNotCovered: observation.state === 'NO_EVIDENCE'
      ? 'No durable evidence for this requested item was found in the source session.'
      : undefined,
  }));

  const assessedAt = summary.endedAt ?? summary.startedAt;
  const coverageWithoutLevel = { assessedItems, assessedAt };
  const coverage: CoverageAssessment = {
    ...coverageWithoutLevel,
    overallLevel: calculateOverallCoverage(coverageWithoutLevel),
  };

  const limitations = buildLimitations(summary, observations);
  const hasAnyCoveredItem = assessedItems.some(item => item.isCovered);
  const sourceIsPhysical = summary.acquisitionMode === SessionAcquisitionMode.REAL_BLE;
  const integrityAllowsReview =
    summary.integrityState !== SessionIntegrityState.CORRUPTED
    && summary.integrityState !== SessionIntegrityState.UNAVAILABLE;

  return Object.freeze({
    sessionId: summary.sessionId,
    vehicleId: summary.vehicleId,
    acquisitionMode: summary.acquisitionMode,
    sessionIntegrity: summary.integrityState,
    observations: Object.freeze(observations),
    coverage,
    limitations: Object.freeze(limitations),
    canAdvanceToProfessionalReview: sourceIsPhysical && integrityAllowsReview && hasAnyCoveredItem,
  });
}

function buildObservation(
  request: RequestedCheckSignal,
  summary?: SignalSummary,
): CheckLiteObservation {
  if (!summary) {
    return Object.freeze({
      ...request,
      state: 'NO_EVIDENCE' as const,
      validReadingsCount: 0,
      noDataCount: 0,
      invalidCount: 0,
      min: null,
      max: null,
      avg: null,
      firstValidAt: null,
      lastValidAt: null,
    });
  }

  const state: CheckObservationState = summary.validReadingsCount > 0
    ? 'OBSERVED'
    : summary.noDataCount > 0
      ? 'NO_DATA'
      : summary.invalidCount > 0
        ? 'INVALID_ONLY'
        : 'NO_EVIDENCE';

  return Object.freeze({
    ...request,
    state,
    validReadingsCount: summary.validReadingsCount,
    noDataCount: summary.noDataCount,
    invalidCount: summary.invalidCount,
    min: summary.min,
    max: summary.max,
    avg: summary.avg,
    firstValidAt: summary.firstValidAt,
    lastValidAt: summary.lastValidAt,
  });
}

function buildLimitations(
  summary: SessionSummaryResult,
  observations: readonly CheckLiteObservation[],
): string[] {
  const limitations: string[] = [];

  if (summary.acquisitionMode !== SessionAcquisitionMode.REAL_BLE) {
    limitations.push(
      `Source session acquisition mode is ${summary.acquisitionMode}; it is not physical vehicle evidence.`,
    );
  }

  if (summary.integrityState !== SessionIntegrityState.COMPLETE) {
    limitations.push(
      `Source session integrity is ${summary.integrityState}; any report must preserve this limitation.`,
    );
  }

  if (summary.gapsDetectedCount > 0) {
    limitations.push(
      `Source session contains ${summary.gapsDetectedCount} detected telemetry gap(s).`,
    );
  }

  for (const observation of observations) {
    if (observation.state === 'NO_EVIDENCE' && observation.isMandatory) {
      limitations.push(`${observation.description}: mandatory requested item was not evaluated.`);
    } else if (observation.state === 'NO_DATA') {
      limitations.push(
        `${observation.description}: NO_DATA was observed. This is an acquisition outcome, not a vehicle failure conclusion.`,
      );
    } else if (observation.state === 'INVALID_ONLY') {
      limitations.push(
        `${observation.description}: only invalid readings were retained; no valid value is claimed.`,
      );
    }
  }

  if (limitations.length === 0) {
    limitations.push(
      'Assessment is limited to the requested items and evidence present in the source Live session.',
    );
  }

  return limitations;
}
