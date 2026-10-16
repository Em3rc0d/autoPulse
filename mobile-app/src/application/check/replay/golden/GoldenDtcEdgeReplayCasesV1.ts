import type { DiagnosticAttemptOutcome } from '../../planner/RetryPolicy';
import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import type { DiagnosticReplayFixture } from '../DiagnosticReplayFixture';
import type {
  GoldenReplayCase,
  GoldenReplayClaimScope,
  GoldenReplayEvidenceRef,
  GoldenReplayExpectation,
  GoldenReplayExpectedDtcObservation,
} from './GoldenReplayContract';

const START = 4000;
const SEMANTIC = 'check.obd.mode03.stored-dtc';
const scopes = (...values: GoldenReplayClaimScope[]): readonly GoldenReplayClaimScope[] => Object.freeze(values);
const outcomes = (...values: DiagnosticAttemptOutcome[]): readonly DiagnosticAttemptOutcome[] => Object.freeze(values);
const expected = (value: GoldenReplayExpectation): GoldenReplayExpectation => Object.freeze(value);
const golden = (value: GoldenReplayCase): GoldenReplayCase => Object.freeze(value);
const observation = (
  outcome: GoldenReplayExpectedDtcObservation['outcome'],
  codes: readonly string[] = [],
  codeOccurrences?: readonly { readonly code: string; readonly count: number }[],
): GoldenReplayExpectedDtcObservation => Object.freeze({
  status: 'STORED', outcome, codes: Object.freeze([...codes]),
  codeOccurrences: codeOccurrences ? Object.freeze([...codeOccurrences]) : undefined,
});

const DTC_CONTRACT: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'Q-CHECK-001-DTC-EDGE-CONTRACT',
  kind: 'REPOSITORY_CONTRACT',
  locator: 'Q-CHECK-001 defines paired DTC decoding, zero/padding truth, duplicate/status preservation, and distinct failure outcomes before parser implementation.',
  supports: scopes('SERVICE_SEMANTICS', 'PARSER_FAILURE_SEMANTICS'),
  independentFromParserOutput: true,
});
const ELM_DTC_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-DTC-PAIR-PADDING',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf Mode 03 example: data after service 43 is interpreted as two-byte DTC pairs and 0000 is padding.',
  supports: scopes('SERVICE_SEMANTICS'),
  independentFromParserOutput: true,
});

function fixture(fixtureId: string, envelope: DiagnosticServiceEnvelope, observedResponseBytes: number): DiagnosticReplayFixture {
  return Object.freeze({
    fixtureId,
    protocol: 'ISO_14230_KWP',
    provenance: `check-golden-dtc-edge/v1:${fixtureId}:SYNTHETIC_NOT_PHYSICAL_CERTIFICATION`,
    startedAt: START,
    scripts: Object.freeze([{
      semanticId: SEMANTIC,
      targetEndpointId: 'ecu-engine',
      events: Object.freeze([{ kind: 'COMMAND_RESPONSE' as const, durationMs: 10, observedResponseBytes, envelope }]),
    }]),
  });
}

function envelope(body: Record<string, unknown>): DiagnosticServiceEnvelope {
  return {
    ...body,
    requestService: '03',
    protocol: 'ISO_14230_KWP',
    sourceEndpointId: 'ecu-engine',
    provenance: 'check-golden-dtc-edge/v1:synthetic',
    observedAt: START + 10,
  } as DiagnosticServiceEnvelope;
}

const MULTIPLE = fixture('multiple-stored-codes', envelope({ kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x33, 0x04, 0x20] }), 5);
const DUPLICATE = fixture('duplicate-code-normalization', envelope({ kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x33, 0x01, 0x33, 0x00, 0x00] }), 7);
const EMPTY_POSITIVE = fixture('positive-empty-list', envelope({ kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [] }), 1);
const PARTIAL = fixture('partial-dtc-response', envelope({ kind: 'PARTIAL', responseService: '43', payload: [0x01], detail: 'synthetic truncated response' }), 2);
const UNSUPPORTED = fixture('unsupported-dtc-service', envelope({ kind: 'UNSUPPORTED' }), 0);

const base = {
  sourceType: 'SYNTHETIC_EDGE_CASE' as const,
  promotionState: 'GOLDEN' as const,
  evidence: Object.freeze([DTC_CONTRACT, ELM_DTC_REFERENCE]),
  semanticIds: Object.freeze([SEMANTIC]),
  executionProfile: Object.freeze({ retryableOutcomes: Object.freeze([]), maxRetries: 0, maxPendingExtensions: 1, minInterCommandDelayMs: 0 }),
  reviewedBy: 'CHECK-MK9 DTC edge evidence review',
};

export const CHECK_GOLDEN_DTC_EDGE_CASES_V1: readonly GoldenReplayCase[] = Object.freeze([
  golden({
    ...base,
    caseId: 'golden-multiple-stored-dtcs',
    claims: scopes('SERVICE_SEMANTICS'),
    fixture: MULTIPLE,
    expected: expected({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([observation('SUCCESS_WITH_CODES', ['P0133', 'P0420'])]) }),
    reviewMethod: 'Two independently specified byte pairs must produce two codes in pair order.',
    limitations: Object.freeze(['Synthetic list; no physical KWP claim.']),
  }),
  golden({
    ...base,
    caseId: 'golden-duplicate-dtc-normalization',
    claims: scopes('SERVICE_SEMANTICS'),
    fixture: DUPLICATE,
    expected: expected({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([observation('SUCCESS_WITH_CODES', ['P0133'], [{ code: 'P0133', count: 2 }])]) }),
    reviewMethod: 'Repeated identical DTC pairs remain one normalized code while occurrenceCount preserves duplicate raw evidence; trailing 0000 remains padding.',
    limitations: Object.freeze(['Synthetic duplicate payload.']),
  }),
  golden({
    ...base,
    caseId: 'golden-positive-empty-dtc-fails-closed',
    claims: scopes('PARSER_FAILURE_SEMANTICS'),
    fixture: EMPTY_POSITIVE,
    expected: expected({ terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: outcomes('INVALID_RESPONSE'), dtcObservations: Object.freeze([observation('INVALID_RESPONSE')]) }),
    reviewMethod: 'A bare positive legacy service byte proves neither a DTC pair nor explicit 0000 padding. Zero-code truth therefore remains unproven and the parser fails closed.',
    limitations: Object.freeze(['A future physical/reference promotion may add an explicitly proven alternate legacy zero-list representation.']),
  }),
  golden({
    ...base,
    caseId: 'golden-partial-dtc-remains-partial',
    claims: scopes('PARSER_FAILURE_SEMANTICS'),
    fixture: PARTIAL,
    expected: expected({ terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: outcomes('PARTIAL'), dtcObservations: Object.freeze([observation('PARTIAL')]) }),
    reviewMethod: 'Partial response bytes are retained but never speculatively decoded into a complete DTC list.',
    limitations: Object.freeze(['Synthetic partial transport event.']),
  }),
  golden({
    ...base,
    caseId: 'golden-unsupported-dtc-is-not-zero',
    claims: scopes('PARSER_FAILURE_SEMANTICS'),
    fixture: UNSUPPORTED,
    expected: expected({ terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: outcomes('UNSUPPORTED'), dtcObservations: Object.freeze([observation('UNSUPPORTED')]) }),
    reviewMethod: 'UNSUPPORTED is preserved as capability/failure truth and cannot be converted to SUCCESS_ZERO_CODES.',
    limitations: Object.freeze(['Synthetic unsupported outcome.']),
  }),
]);
