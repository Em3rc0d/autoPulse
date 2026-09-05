import type { DiagnosticAttemptOutcome } from '../../planner/RetryPolicy';
import type { DiagnosticScanTerminalState } from '../../../../domain/check/DiagnosticScanState';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';

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
  /** Must be true when the expected result was established independently of the parser under test. */
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
}

export interface GoldenReplayExpectation {
  readonly terminalState: DiagnosticScanTerminalState;
  readonly commandsIssued: number;
  readonly attemptOutcomes: readonly DiagnosticAttemptOutcome[];
  readonly dtcObservations?: readonly GoldenReplayExpectedDtcObservation[];
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

export function assertValidGoldenReplayCase(candidate: GoldenReplayCase): void {
  nonEmpty(candidate.caseId, 'Golden replay caseId');
  nonEmpty(candidate.reviewedBy, `Golden replay ${candidate.caseId} reviewedBy`);
  nonEmpty(candidate.reviewMethod, `Golden replay ${candidate.caseId} reviewMethod`);

  if (candidate.semanticIds.length === 0) {
    throw new Error(`Golden replay ${candidate.caseId} must declare at least one semanticId`);
  }
  if (new Set(candidate.semanticIds).size !== candidate.semanticIds.length) {
    throw new Error(`Golden replay ${candidate.caseId} contains duplicate semanticIds`);
  }
  if (candidate.claims.length === 0) {
    throw new Error(`Golden replay ${candidate.caseId} must declare at least one bounded claim`);
  }

  if (!Number.isInteger(candidate.executionProfile.maxRetries) || candidate.executionProfile.maxRetries < 0) {
    throw new Error(`Golden replay ${candidate.caseId} maxRetries must be a non-negative integer`);
  }
  if (!Number.isInteger(candidate.executionProfile.maxPendingExtensions) || candidate.executionProfile.maxPendingExtensions < 0) {
    throw new Error(`Golden replay ${candidate.caseId} maxPendingExtensions must be a non-negative integer`);
  }
  if (!Number.isInteger(candidate.executionProfile.minInterCommandDelayMs) || candidate.executionProfile.minInterCommandDelayMs < 0) {
    throw new Error(`Golden replay ${candidate.caseId} minInterCommandDelayMs must be a non-negative integer`);
  }

  const promoted = PROMOTION_RANK[candidate.promotionState] >= PROMOTION_RANK.GOLDEN;
  if (promoted) {
    if (candidate.evidence.length === 0) {
      throw new Error(`Golden replay ${candidate.caseId} cannot be GOLDEN without evidence`);
    }
    if (!candidate.evidence.some(item => item.independentFromParserOutput)) {
      throw new Error(`Golden replay ${candidate.caseId} cannot be GOLDEN without an independent expected-result source`);
    }
  }

  for (const evidence of candidate.evidence) {
    nonEmpty(evidence.evidenceId, `Golden replay ${candidate.caseId} evidenceId`);
    nonEmpty(evidence.locator, `Golden replay ${candidate.caseId} evidence locator`);
    if (evidence.supports.length === 0) {
      throw new Error(`Golden replay ${candidate.caseId} evidence ${evidence.evidenceId} must declare bounded support`);
    }
  }

  const physicalClaim = candidate.claims.includes('PHYSICAL_TRANSPORT') || candidate.claims.includes('PHYSICAL_TIMING');
  if (physicalClaim && candidate.sourceType !== 'PHYSICAL_CAPTURE') {
    throw new Error(`Golden replay ${candidate.caseId} cannot make a physical claim from ${candidate.sourceType}`);
  }

  if (candidate.promotionState === 'PHYSICALLY_CERTIFIED') {
    if (candidate.sourceType !== 'PHYSICAL_CAPTURE') {
      throw new Error(`Golden replay ${candidate.caseId} physical certification requires PHYSICAL_CAPTURE`);
    }
    if (!candidate.rawEvidenceSha256?.match(/^[a-f0-9]{64}$/i)) {
      throw new Error(`Golden replay ${candidate.caseId} physical certification requires a SHA-256 raw evidence digest`);
    }
    if (!candidate.evidence.some(item => item.kind === 'PHYSICAL_RAW_CAPTURE')) {
      throw new Error(`Golden replay ${candidate.caseId} physical certification requires physical raw capture evidence`);
    }
  }
}

export function isReplayCertificationEligible(candidate: GoldenReplayCase): boolean {
  assertValidGoldenReplayCase(candidate);
  return PROMOTION_RANK[candidate.promotionState] >= PROMOTION_RANK.GOLDEN;
}
