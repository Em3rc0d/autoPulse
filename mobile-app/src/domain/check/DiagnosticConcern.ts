import type { DiagnosticEvidenceQuality } from './DiagnosticEvidence';

export type DiagnosticConcernCategory =
  | 'COMBUSTION'
  | 'AIR_FUEL'
  | 'COOLING'
  | 'EMISSIONS'
  | 'ELECTRICAL'
  | 'SENSOR'
  | 'COMMUNICATION'
  | 'TRANSMISSION'
  | 'UNKNOWN';

export interface DiagnosticCauseGroup {
  readonly causeGroupId: string;
  readonly label: string;
  readonly confidence: DiagnosticEvidenceQuality;
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly limitations: readonly string[];
}

export interface DiagnosticConcern {
  readonly concernId: string;
  readonly category: DiagnosticConcernCategory;
  readonly dtcObservationIds: readonly string[];
  readonly supportingEvidenceIds: readonly string[];
  readonly contradictingEvidenceIds: readonly string[];
  readonly unavailableEvidenceIds: readonly string[];
  readonly interpretation?: string;
  readonly eventConfidence: DiagnosticEvidenceQuality;
  readonly conditionConfidence: DiagnosticEvidenceQuality;
  readonly causeGroups: readonly DiagnosticCauseGroup[];
  readonly limitations: readonly string[];
}
