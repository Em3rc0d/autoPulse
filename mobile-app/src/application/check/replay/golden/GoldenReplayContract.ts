import type { DiagnosticAttemptOutcome } from '../../planner/RetryPolicy';
import type { DiagnosticScanTerminalState } from '../../../../domain/check/DiagnosticScanState';
import {
  assertValidDiagnosticReplayFixture,
  type DiagnosticReplayFixture,
} from '../DiagnosticReplayFixture';

export type GoldenReplaySourceType =
  | 'VERIFIED_REFERENCE'
  | 'SYNTHETIC_EDGE_CASE'
  | 'PHYSICAL_CAPTURE';

export type GoldenReplayPromotionState =
  | 'NORMALIZED_FIXTURE'
  | 'REVIEWED'
  | 'GOLDEN'
  | 'PHYSICALLY_CERTIFIED';

export type GoldenReplayClaimScope =
  | 'SERVICE_SEMANTICS'
  | 'ENGINE_CONTROL_FLOW'
  | 'PARSER_FAILURE_SEMANTICS'
  | 'TRANSPORT_ENVELOPE'
  | 'ENDPOINT_ATTRIBUTION'
  | 'PHYSICAL_TRANSPORT'
  | 'PHYSICAL_TIMING';

export interface GoldenReplayEvidenceRef {
  readonly evidenceId: string;
  readonly kind: 'VENDOR_TECHNICAL_REFERENCE' | 'REPOSITORY_CONTRACT' | 'PHYSICAL_RAW_CAPTURE';
  readonly locator: string;
  readonly supports: readonly GoldenReplayClaimScope[];
  readonly independentFromParserOutput: boolean;
}

export interface GoldenReplayExpectedDtcObservation {
  readonly status: 'STORED' | 'PENDING' | 'PERMANENT';
  readonly outcome:
    | 'SUCCESS_WITH_CODES'
    | 'SUCCESS_ZERO_CODES'
    | 'NO_DATA'
    | 'TIMEOUT'
    | 'INVALID_RESPONSE'
    | 'NEGATIVE_RESPONSE'
    | 'RESPONSE_PENDING'
    | 'DISCONNECTED'
    | 'UNSUPPORTED'
    | 'FAILED'
    | 'PARTIAL';
  readonly codes: readonly string[];
  /** Optional exact occurrence counts after duplicate-code normalization. */
  readonly codeOccurrences?: readonly { readonly code: string; readonly count: number }[];
  /** Omit when attribution is outside the case claim; null explicitly asserts UNATTRIBUTED. */
  readonly sourceEndpointId?: string | null;
}

export interface GoldenReplayExpectation {
  readonly terminalState: DiagnosticScanTerminalState;
  readonly commandsIssued: number;
  readonly attemptOutcomes: readonly DiagnosticAttemptOutcome[];
  readonly dtcObservations?: readonly GoldenReplayExpectedDtcObservation[];
  readonly limitationsContain?: readonly string[];
  readonly pidSupport?: {
    readonly command: string;
    readonly advertisedPids: readonly string[];
    readonly continuationCommand: string | null;
  };
}

export interface GoldenReplayExecutionProfile {
  readonly retryableOutcomes: readonly ('TIMEOUT' | 'NO_DATA' | 'FAILED')[];
  readonly maxRetries: number;
  readonly maxPendingExtensions: number;
  readonly minInterCommandDelayMs: number;
}

export interface GoldenReplayCase {
  readonly caseId: string;
  readonly sourceType: GoldenReplaySourceType;
  readonly promotionState: GoldenReplayPromotionState;
  readonly claims: readonly GoldenReplayClaimScope[];
  readonly evidence: readonly GoldenReplayEvidenceRef[];
  readonly fixture: DiagnosticReplayFixture;
  readonly semanticIds: readonly string[];
  readonly executionProfile: GoldenReplayExecutionProfile;
  readonly expected: GoldenReplayExpectation;
  readonly reviewedBy: string;
  readonly reviewMethod: string;
  readonly rawEvidenceSha256?: string;
  readonly limitations: readonly string[];
}

const PROMOTION_RANK: Readonly<Record<GoldenReplayPromotionState, number>> = Object.freeze({
  NORMALIZED_FIXTURE: 0,
  REVIEWED: 1,
  GOLDEN: 2,
  PHYSICALLY_CERTIFIED: 3,
});

function nonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must be non-empty`);
}

function uniqueNonEmpty(values: readonly string[], label: string): void {
  values.forEach(value => nonEmpty(value, label));
  if (new Set(values.map(value => value.trim())).size !== values.length) {
    throw new Error(`${label} contains duplicates`);
  }
}

function assertExpectedObservation(candidate: GoldenReplayCase, index: number, observation: GoldenReplayExpectedDtcObservation): void {
  uniqueNonEmpty(observation.codes, `Golden replay ${candidate.caseId} dtc[${index}] codes`);
  if (observation.sourceEndpointId !== undefined && observation.sourceEndpointId !== null) {
    nonEmpty(observation.sourceEndpointId, `Golden replay ${candidate.caseId} dtc[${index}] sourceEndpointId`);
  }
  if (observation.codeOccurrences) {
    const occurrenceCodes = observation.codeOccurrences.map(item => item.code);
    uniqueNonEmpty(occurrenceCodes, `Golden replay ${candidate.caseId} dtc[${index}] occurrence codes`);
    for (const occurrence of observation.codeOccurrences) {
      if (!Number.isInteger(occurrence.count) || occurrence.count < 1) {
        throw new Error(`Golden replay ${candidate.caseId} dtc[${index}] occurrence count must be a positive integer`);
      }
      if (!observation.codes.includes(occurrence.code)) {
        throw new Error(`Golden replay ${candidate.caseId} dtc[${index}] occurrence ${occurrence.code} is not in expected codes`);
      }
    }
  }
}

export function assertValidGoldenReplayCase(candidate: GoldenReplayCase): void {
  nonEmpty(candidate.caseId, 'Golden replay caseId');
  nonEmpty(candidate.reviewedBy, `Golden replay ${candidate.caseId} reviewedBy`);
  nonEmpty(candidate.reviewMethod, `Golden replay ${candidate.caseId} reviewMethod`);
  assertValidDiagnosticReplayFixture(candidate.fixture);

  if (candidate.semanticIds.length === 0) throw new Error(`Golden replay ${candidate.caseId} must declare at least one semanticId`);
  uniqueNonEmpty(candidate.semanticIds, `Golden replay ${candidate.caseId} semanticIds`);
  if (candidate.claims.length === 0) throw new Error(`Golden replay ${candidate.caseId} must declare at least one bounded claim`);
  if (new Set(candidate.claims).size !== candidate.claims.length) throw new Error(`Golden replay ${candidate.caseId} contains duplicate claims`);

  if (!Number.isInteger(candidate.executionProfile.maxRetries) || candidate.executionProfile.maxRetries < 0) throw new Error(`Golden replay ${candidate.caseId} maxRetries must be a non-negative integer`);
  if (!Number.isInteger(candidate.executionProfile.maxPendingExtensions) || candidate.executionProfile.maxPendingExtensions < 0) throw new Error(`Golden replay ${candidate.caseId} maxPendingExtensions must be a non-negative integer`);
  if (!Number.isInteger(candidate.executionProfile.minInterCommandDelayMs) || candidate.executionProfile.minInterCommandDelayMs < 0) throw new Error(`Golden replay ${candidate.caseId} minInterCommandDelayMs must be a non-negative integer`);
  if (!Number.isInteger(candidate.expected.commandsIssued) || candidate.expected.commandsIssued < 0) throw new Error(`Golden replay ${candidate.caseId} expected commandsIssued must be a non-negative integer`);
  candidate.expected.dtcObservations?.forEach((observation, index) => assertExpectedObservation(candidate, index, observation));

  const evidenceIds = candidate.evidence.map(item => item.evidenceId);
  uniqueNonEmpty(evidenceIds, `Golden replay ${candidate.caseId} evidence IDs`);
  for (const evidence of candidate.evidence) {
    nonEmpty(evidence.locator, `Golden replay ${candidate.caseId} evidence locator`);
    if (evidence.supports.length === 0) throw new Error(`Golden replay ${candidate.caseId} evidence ${evidence.evidenceId} must declare bounded support`);
    if (new Set(evidence.supports).size !== evidence.supports.length) throw new Error(`Golden replay ${candidate.caseId} evidence ${evidence.evidenceId} contains duplicate support claims`);
  }

  if (candidate.rawEvidenceSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(candidate.rawEvidenceSha256)) {
    throw new Error(`Golden replay ${candidate.caseId} rawEvidenceSha256 must be a 64-character hexadecimal SHA-256 digest`);
  }

  const physicalClaims = candidate.claims.filter(claim => claim === 'PHYSICAL_TRANSPORT' || claim === 'PHYSICAL_TIMING');
  if (physicalClaims.length > 0 && candidate.sourceType !== 'PHYSICAL_CAPTURE') {
    throw new Error(`Golden replay ${candidate.caseId} cannot make a physical claim from ${candidate.sourceType}`);
  }
  if (physicalClaims.length > 0 && candidate.promotionState !== 'PHYSICALLY_CERTIFIED') {
    throw new Error(`Golden replay ${candidate.caseId} physical claims require PHYSICALLY_CERTIFIED promotion`);
  }

  if (candidate.promotionState === 'PHYSICALLY_CERTIFIED') {
    if (candidate.sourceType !== 'PHYSICAL_CAPTURE') throw new Error(`Golden replay ${candidate.caseId} physical certification requires PHYSICAL_CAPTURE`);
    if (physicalClaims.length === 0) throw new Error(`Golden replay ${candidate.caseId} PHYSICALLY_CERTIFIED requires at least one physical claim`);
    if (!candidate.rawEvidenceSha256) throw new Error(`Golden replay ${candidate.caseId} physical certification requires a SHA-256 raw evidence digest`);
    if (!candidate.evidence.some(item => item.kind === 'PHYSICAL_RAW_CAPTURE')) throw new Error(`Golden replay ${candidate.caseId} physical certification requires physical raw capture evidence`);
    for (const claim of physicalClaims) {
      if (!candidate.evidence.some(item => item.kind === 'PHYSICAL_RAW_CAPTURE' && item.independentFromParserOutput && item.supports.includes(claim))) {
        throw new Error(`Golden replay ${candidate.caseId} physical claim ${claim} lacks independent raw capture evidence`);
      }
    }
  }

  const promoted = PROMOTION_RANK[candidate.promotionState] >= PROMOTION_RANK.GOLDEN;
  if (promoted) {
    if (candidate.evidence.length === 0) throw new Error(`Golden replay ${candidate.caseId} cannot be GOLDEN without evidence`);
    for (const claim of candidate.claims) {
      if (!candidate.evidence.some(item => item.independentFromParserOutput && item.supports.includes(claim))) {
        throw new Error(`Golden replay ${candidate.caseId} claim ${claim} lacks independent supporting evidence`);
      }
    }
  }
}

export function isReplayCertificationEligible(candidate: GoldenReplayCase): boolean {
  assertValidGoldenReplayCase(candidate);
  return PROMOTION_RANK[candidate.promotionState] >= PROMOTION_RANK.GOLDEN;
}
