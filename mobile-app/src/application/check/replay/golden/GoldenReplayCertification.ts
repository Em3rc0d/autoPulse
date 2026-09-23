import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import { DiagnosticReplayExecutor } from '../DiagnosticReplayExecutor';
import { runDiagnosticScan } from '../DiagnosticScanEngine';
import {
  assertValidGoldenReplayCase,
  GoldenReplayCase,
  GoldenReplayExpectedDtcObservation,
  GoldenReplayExpectedPidSupportObservation,
  isReplayCertificationEligible,
} from './GoldenReplayContract';

export const CHECK_GOLDEN_REPLAY_CERTIFIER_VERSION = 'check-golden-replay-certifier/v4' as const;

export interface GoldenReplayCaseReceipt {
  readonly caseId: string;
  readonly promotionState: GoldenReplayCase['promotionState'];
  readonly eligible: boolean;
  readonly passed: boolean;
  readonly mismatches: readonly string[];
}

export interface GoldenReplayCertificationReceipt {
  readonly certifierVersion: typeof CHECK_GOLDEN_REPLAY_CERTIFIER_VERSION;
  readonly status: 'PASS' | 'FAIL';
  readonly eligibleCases: number;
  readonly passedCases: number;
  readonly cases: readonly GoldenReplayCaseReceipt[];
}

const sameArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

function compareDtcObservation(
  actual: {
    readonly status: string;
    readonly outcome: string;
    readonly sourceEndpointId: string | null;
    readonly codes: readonly { readonly code: string; readonly occurrenceCount: number }[];
  },
  expected: GoldenReplayExpectedDtcObservation,
  index: number,
  mismatches: string[],
): void {
  if (actual.status !== expected.status) mismatches.push(`dtc[${index}].status expected ${expected.status} got ${actual.status}`);
  if (actual.outcome !== expected.outcome) mismatches.push(`dtc[${index}].outcome expected ${expected.outcome} got ${actual.outcome}`);
  if (Object.prototype.hasOwnProperty.call(expected, 'sourceEndpointId') && actual.sourceEndpointId !== expected.sourceEndpointId) {
    mismatches.push(`dtc[${index}].sourceEndpointId expected ${String(expected.sourceEndpointId)} got ${String(actual.sourceEndpointId)}`);
  }
  const codes = actual.codes.map(code => code.code);
  if (!sameArray(codes, expected.codes)) mismatches.push(`dtc[${index}].codes expected ${expected.codes.join(',')} got ${codes.join(',')}`);
  for (const occurrence of expected.codeOccurrences ?? []) {
    const actualCode = actual.codes.find(code => code.code === occurrence.code);
    if (!actualCode) {
      mismatches.push(`dtc[${index}].occurrence ${occurrence.code} missing`);
    } else if (actualCode.occurrenceCount !== occurrence.count) {
      mismatches.push(`dtc[${index}].occurrence ${occurrence.code} expected ${occurrence.count} got ${actualCode.occurrenceCount}`);
    }
  }
}

function comparePidSupport(
  actual: {
    readonly command: string;
    readonly advertisedPids: readonly string[];
    readonly continuationCommand: string | null;
    readonly sourceEndpointId: string | null;
  },
  expected: GoldenReplayExpectedPidSupportObservation,
  label: string,
  mismatches: string[],
): void {
  if (actual.command !== expected.command) mismatches.push(`${label}.command expected ${expected.command} got ${actual.command}`);
  if (!sameArray(actual.advertisedPids, expected.advertisedPids)) mismatches.push(`${label}.advertisedPids mismatch`);
  if (actual.continuationCommand !== expected.continuationCommand) mismatches.push(`${label}.continuation expected ${expected.continuationCommand} got ${actual.continuationCommand}`);
  if (Object.prototype.hasOwnProperty.call(expected, 'sourceEndpointId') && actual.sourceEndpointId !== expected.sourceEndpointId) {
    mismatches.push(`${label}.sourceEndpointId expected ${String(expected.sourceEndpointId)} got ${String(actual.sourceEndpointId)}`);
  }
}

export async function certifyGoldenReplayCase(candidate: GoldenReplayCase): Promise<GoldenReplayCaseReceipt> {
  assertValidGoldenReplayCase(candidate);
  const eligible = isReplayCertificationEligible(candidate);
  if (!eligible) {
    return Object.freeze({ caseId: candidate.caseId, promotionState: candidate.promotionState, eligible: false, passed: false, mismatches: Object.freeze(['CASE_NOT_PROMOTED_TO_GOLDEN']) });
  }

  const plan = buildDiagnosticScanPlan({
    planId: `golden:${candidate.caseId}`,
    createdAt: candidate.fixture.startedAt,
    protocol: candidate.fixture.protocol,
    registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
    proposals: candidate.semanticIds.map(semanticId => ({
      semanticId,
      required: true,
      targetEndpointId: candidate.fixture.scripts.find(script => script.semanticId === semanticId)?.targetEndpointId ?? null,
      rationaleEvidenceIds: candidate.evidence.map(item => item.evidenceId),
    })),
    budget: {
      maxCommands: Math.max(candidate.semanticIds.length + candidate.executionProfile.maxRetries + 2, 4),
      maxResponseBytes: 4096,
      maxBytesPerResponse: 1024,
      maxElapsedMs: 10000,
      minInterCommandDelayMs: candidate.executionProfile.minInterCommandDelayMs,
      provenance: `${candidate.caseId}:golden-replay-budget`,
    },
    retryPolicy: {
      maxRetries: candidate.executionProfile.maxRetries,
      retryableOutcomes: candidate.executionProfile.retryableOutcomes,
      responsePending: { maxExtensions: candidate.executionProfile.maxPendingExtensions, extensionMs: 5000 },
      provenance: `${candidate.caseId}:golden-replay-retry`,
    },
    deadlinePolicy: {
      overallDeadlineMs: 10000,
      stageDeadlineMs: { CAPABILITY_DISCOVERY: 5000, DTC_CORE: 10000 },
      provenance: `${candidate.caseId}:golden-replay-deadline`,
    },
  });

  const executor = new DiagnosticReplayExecutor(candidate.fixture);
  const result = await runDiagnosticScan({ plan, executor });
  const mismatches: string[] = [];
  if (result.state !== candidate.expected.terminalState) mismatches.push(`terminalState expected ${candidate.expected.terminalState} got ${result.state}`);
  if (result.usage.commandsIssued !== candidate.expected.commandsIssued) mismatches.push(`commandsIssued expected ${candidate.expected.commandsIssued} got ${result.usage.commandsIssued}`);

  const attemptOutcomes = result.attempts.map(item => item.outcome);
  if (!sameArray(attemptOutcomes, candidate.expected.attemptOutcomes)) {
    mismatches.push(`attemptOutcomes expected ${candidate.expected.attemptOutcomes.join(',')} got ${attemptOutcomes.join(',')}`);
  }

  if (candidate.expected.dtcObservations) {
    if (result.dtcResults.length !== candidate.expected.dtcObservations.length) mismatches.push(`dtcResults length expected ${candidate.expected.dtcObservations.length} got ${result.dtcResults.length}`);
    candidate.expected.dtcObservations.forEach((expected, index) => {
      const actual = result.dtcResults[index];
      if (actual) compareDtcObservation(actual, expected, index, mismatches);
    });
  }

  for (const requiredLimitation of candidate.expected.limitationsContain ?? []) {
    if (!result.limitations.includes(requiredLimitation)) mismatches.push(`missing limitation ${requiredLimitation}`);
  }

  if (candidate.expected.pidSupport) {
    const actual = result.pidSupportResults[0];
    if (!actual) mismatches.push('pidSupport expected but no result produced');
    else comparePidSupport(actual, candidate.expected.pidSupport, 'pidSupport', mismatches);
  }

  if (candidate.expected.pidSupportObservations) {
    if (result.pidSupportResults.length !== candidate.expected.pidSupportObservations.length) {
      mismatches.push(`pidSupportResults length expected ${candidate.expected.pidSupportObservations.length} got ${result.pidSupportResults.length}`);
    }
    candidate.expected.pidSupportObservations.forEach((expected, index) => {
      const actual = result.pidSupportResults[index];
      if (actual) comparePidSupport(actual, expected, `pidSupport[${index}]`, mismatches);
    });
  }

  try {
    executor.assertFullyConsumed();
  } catch (error) {
    mismatches.push(`fixture-consumption:${error instanceof Error ? error.message : String(error)}`);
  }

  return Object.freeze({ caseId: candidate.caseId, promotionState: candidate.promotionState, eligible: true, passed: mismatches.length === 0, mismatches: Object.freeze([...mismatches]) });
}

export async function certifyGoldenReplayCorpus(cases: readonly GoldenReplayCase[]): Promise<GoldenReplayCertificationReceipt> {
  const ids = cases.map(candidate => candidate.caseId.trim());
  if (ids.some(id => id.length === 0)) throw new Error('Golden replay corpus contains an empty caseId');
  if (new Set(ids).size !== ids.length) throw new Error('Golden replay corpus contains duplicate caseIds');

  const receipts = await Promise.all(cases.map(certifyGoldenReplayCase));
  const eligible = receipts.filter(item => item.eligible);
  const passed = eligible.filter(item => item.passed);
  return Object.freeze({
    certifierVersion: CHECK_GOLDEN_REPLAY_CERTIFIER_VERSION,
    status: eligible.length > 0 && passed.length === eligible.length ? 'PASS' : 'FAIL',
    eligibleCases: eligible.length,
    passedCases: passed.length,
    cases: Object.freeze(receipts),
  });
}
