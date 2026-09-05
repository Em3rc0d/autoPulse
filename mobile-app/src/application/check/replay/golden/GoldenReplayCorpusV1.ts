import type { DiagnosticProtocol } from '../../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticAttemptOutcome } from '../../planner/RetryPolicy';
import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import type { DiagnosticReplayFixture, DiagnosticReplayScript } from '../DiagnosticReplayFixture';
import {
  CHECK_REPLAY_DISCONNECT_KWP,
  CHECK_REPLAY_MULTI_STATUS_KWP,
  CHECK_REPLAY_RESPONSE_PENDING_KWP,
  CHECK_REPLAY_STORED_SINGLE_CAN,
  CHECK_REPLAY_STORED_SINGLE_KWP,
  CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP,
  CHECK_REPLAY_ZERO_DTC_KWP,
} from '../fixtures/DiagnosticReplayCorpusV1';
import type {
  GoldenReplayCase,
  GoldenReplayClaimScope,
  GoldenReplayEvidenceRef,
  GoldenReplayExpectation,
  GoldenReplayExpectedDtcObservation,
} from './GoldenReplayContract';

export const CHECK_GOLDEN_REPLAY_CORPUS_VERSION = 'check-golden-replay-corpus/v1' as const;

type EnvelopeBaseKey =
  | 'protocol'
  | 'requestService'
  | 'sourceEndpointId'
  | 'observedAt'
  | 'provenance';
type StripEnvelopeBase<T> = T extends DiagnosticServiceEnvelope ? Omit<T, EnvelopeBaseKey> : never;
type DiagnosticEnvelopeBody = StripEnvelopeBase<DiagnosticServiceEnvelope>;

const scopes = (...values: GoldenReplayClaimScope[]): readonly GoldenReplayClaimScope[] => Object.freeze(values);
const outcomes = (...values: DiagnosticAttemptOutcome[]): readonly DiagnosticAttemptOutcome[] => Object.freeze(values);
const dtc = (
  status: GoldenReplayExpectedDtcObservation['status'],
  outcome: GoldenReplayExpectedDtcObservation['outcome'],
  codes: readonly string[] = [],
): GoldenReplayExpectedDtcObservation => Object.freeze({ status, outcome, codes: Object.freeze([...codes]) });
const expectation = (value: GoldenReplayExpectation): GoldenReplayExpectation => Object.freeze(value);
const golden = (value: GoldenReplayCase): GoldenReplayCase => Object.freeze(value);

const ELM327_DTC_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-DATASHEET-DTC-P34',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf p.35 (PDF index p34): Mode 03 request has no PID; example 43 01 33 00 00 00 00; DTC bytes are paired; 0000 is padding; ISO15765/CAN adds a DTC-count byte.',
  supports: scopes('SERVICE_SEMANTICS', 'TRANSPORT_ENVELOPE'),
  independentFromParserOutput: true,
});

const ELM327_PENDING_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-DATASHEET-RESPONSE-PENDING-P45',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf p.46 (PDF index p45): KWP/CAN Response Pending has form 7F xx 78 and extends waiting rather than issuing a new semantic request.',
  supports: scopes('ENGINE_CONTROL_FLOW', 'TRANSPORT_ENVELOPE'),
  independentFromParserOutput: true,
});

const ELM327_NO_DATA_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-DATASHEET-NO-DATA',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf pp.27/89: NO DATA is emitted after the configured wait when no acceptable vehicle response is detected; it is not numeric zero.',
  supports: scopes('SERVICE_SEMANTICS', 'ENGINE_CONTROL_FLOW'),
  independentFromParserOutput: true,
});

const ELM327_MODE01_SUPPORT_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-DATASHEET-0100-P31',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf p.32 (PDF index p31): 01 00 example response 41 00 BE 1F B8 10; 00 echoes the requested PID and the next four bytes are the supported-PID bitmap.',
  supports: scopes('SERVICE_SEMANTICS'),
  independentFromParserOutput: true,
});

const CHECK_DTC_CONTRACT: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'Q-CHECK-001-SEMANTIC-CONTRACT',
  kind: 'REPOSITORY_CONTRACT',
  locator: 'mining-site/quarries/Q-CHECK-001-OBD-DTC-SERVICES-20260904/README.md — semantic boundary closed before MK4 parser implementation.',
  supports: scopes('SERVICE_SEMANTICS', 'PARSER_FAILURE_SEMANTICS', 'ENDPOINT_ATTRIBUTION'),
  independentFromParserOutput: true,
});

const CHECK_TRANSPORT_CONTRACT: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'Q-CHECK-011-TRANSPORT-CONTRACT',
  kind: 'REPOSITORY_CONTRACT',
  locator: 'mining-site/quarries/Q-CHECK-011-TRANSPORT-BEHAVIOR-20260904/README.md — transport outcomes, bounded pending/retry, source ambiguity and disconnect semantics closed before MK6.',
  supports: scopes('ENGINE_CONTROL_FLOW', 'TRANSPORT_ENVELOPE', 'ENDPOINT_ATTRIBUTION'),
  independentFromParserOutput: true,
});

const START = 2000;
const envelope = (
  protocol: DiagnosticProtocol,
  requestService: string,
  sourceEndpointId: string | null,
  observedAt: number,
  body: DiagnosticEnvelopeBody,
): DiagnosticServiceEnvelope => ({
  ...body,
  protocol,
  requestService,
  sourceEndpointId,
  observedAt,
  provenance: `${CHECK_GOLDEN_REPLAY_CORPUS_VERSION}:reviewed-normalization`,
} as DiagnosticServiceEnvelope);

const fixture = (
  fixtureId: string,
  protocol: DiagnosticProtocol,
  scripts: readonly DiagnosticReplayScript[],
): DiagnosticReplayFixture => Object.freeze({
  fixtureId,
  protocol,
  provenance: `${CHECK_GOLDEN_REPLAY_CORPUS_VERSION}:reviewed`,
  startedAt: START,
  scripts: Object.freeze([...scripts]),
});

const oneEvent = (
  semanticId: string,
  protocol: DiagnosticProtocol,
  requestService: string,
  body: DiagnosticEnvelopeBody,
  observedResponseBytes: number,
  targetEndpointId: string | null = 'ecu-engine',
): DiagnosticReplayScript => ({
  semanticId,
  targetEndpointId,
  events: Object.freeze([{
    kind: 'COMMAND_RESPONSE' as const,
    durationMs: 10,
    observedResponseBytes,
    envelope: envelope(protocol, requestService, targetEndpointId, START + 10, body),
  }]),
});

const PENDING_ONLY_KWP = fixture('golden-pending-only-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode07.pending-dtc', 'ISO_14230_KWP', '07', { kind: 'POSITIVE_RESPONSE', responseService: '47', payload: [0x01, 0x33] }, 3),
]);
const PERMANENT_ONLY_KWP = fixture('golden-permanent-only-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode0a.permanent-dtc', 'ISO_14230_KWP', '0A', { kind: 'POSITIVE_RESPONSE', responseService: '4A', payload: [0x04, 0x20] }, 3),
]);
const NO_DATA_KWP = fixture('golden-no-data-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode03.stored-dtc', 'ISO_14230_KWP', '03', { kind: 'NO_DATA' }, 0),
]);
const NEGATIVE_RESPONSE_KWP = fixture('golden-negative-response-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode03.stored-dtc', 'ISO_14230_KWP', '03', { kind: 'NEGATIVE_RESPONSE', negativeResponseCode: '11' }, 3),
]);
const MALFORMED_ODD_DTC_KWP = fixture('golden-malformed-odd-dtc-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode03.stored-dtc', 'ISO_14230_KWP', '03', { kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01] }, 2),
]);
const MODE01_SUPPORT_REFERENCE_KWP = fixture('golden-mode01-support-00-reference-shape', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode01.support.00', 'ISO_14230_KWP', '01', { kind: 'POSITIVE_RESPONSE', responseService: '41', payload: [0x00, 0xBE, 0x1F, 0xB8, 0x10] }, 6),
]);

const profile = (
  retryableOutcomes: readonly ('TIMEOUT' | 'NO_DATA' | 'FAILED')[] = [],
  maxRetries = 0,
  maxPendingExtensions = 1,
) => Object.freeze({ retryableOutcomes, maxRetries, maxPendingExtensions, minInterCommandDelayMs: 0 });

const cases: GoldenReplayCase[] = [
  golden({
    caseId: 'golden-legacy-mode03-p0133', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'), evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_STORED_SINGLE_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('STORED', 'SUCCESS_WITH_CODES', ['P0133'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Expected DTC pair/padding semantics derive from the ELM327 vendor example, not parser output; KWP is only the synthetic replay carrier.',
    limitations: Object.freeze(['Does not certify a physical KWP vehicle response shape.']),
  }),
  golden({
    caseId: 'golden-zero-dtc-core', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS', 'PARSER_FAILURE_SEMANTICS'), evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_ZERO_DTC_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc', 'check.obd.mode07.pending-dtc', 'check.obd.mode0a.permanent-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 3, attemptOutcomes: outcomes('SUCCESS', 'SUCCESS', 'SUCCESS'), dtcObservations: Object.freeze([dtc('STORED', 'SUCCESS_ZERO_CODES'), dtc('PENDING', 'SUCCESS_ZERO_CODES'), dtc('PERMANENT', 'SUCCESS_ZERO_CODES')]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: '0000 padding/non-code semantics plus pre-parser Q-CHECK-001 result semantics establish zero-list truth independently.',
    limitations: Object.freeze(['Synthetic zero-result shapes; not physical vehicle evidence.']),
  }),
  golden({
    caseId: 'golden-pending-only', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'), evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: PENDING_ONLY_KWP, semanticIds: Object.freeze(['check.obd.mode07.pending-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('PENDING', 'SUCCESS_WITH_CODES', ['P0133'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Mode 07→PENDING mapping is pre-parser contract evidence; P0133 pair semantics come from independent vendor reference.',
    limitations: Object.freeze(['Mode 07 physical transport envelope remains unclaimed.']),
  }),
  golden({
    caseId: 'golden-permanent-only', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'), evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: PERMANENT_ONLY_KWP, semanticIds: Object.freeze(['check.obd.mode0a.permanent-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('PERMANENT', 'SUCCESS_WITH_CODES', ['P0420'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Mode 0A→PERMANENT and byte-pair DTC representation are fixed by Q-CHECK-001 before parser implementation.',
    limitations: Object.freeze(['Mode 0A physical transport envelope remains unclaimed.']),
  }),
  golden({
    caseId: 'golden-same-code-multi-status', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'), evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_MULTI_STATUS_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc', 'check.obd.mode07.pending-dtc', 'check.obd.mode0a.permanent-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 3, attemptOutcomes: outcomes('SUCCESS', 'SUCCESS', 'SUCCESS'), dtcObservations: Object.freeze([dtc('STORED', 'SUCCESS_WITH_CODES', ['P0133']), dtc('PENDING', 'SUCCESS_WITH_CODES', ['P0133']), dtc('PERMANENT', 'SUCCESS_WITH_CODES', ['P0420'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Pre-parser invariant requires status observations to survive code de-duplication.',
    limitations: Object.freeze(['Synthetic status-combination case.']),
  }),
  golden({
    caseId: 'golden-no-data-is-not-zero', sourceType: 'VERIFIED_REFERENCE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS', 'ENGINE_CONTROL_FLOW'), evidence: Object.freeze([ELM327_NO_DATA_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: NO_DATA_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: outcomes('NO_DATA'), dtcObservations: Object.freeze([dtc('STORED', 'NO_DATA')]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'ELM vendor documentation independently defines NO DATA as absence of acceptable response, not zero DTCs.',
    limitations: Object.freeze(['Does not certify why a particular physical vehicle produced NO DATA.']),
  }),
  golden({
    caseId: 'golden-negative-response-distinct', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('PARSER_FAILURE_SEMANTICS'), evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: NEGATIVE_RESPONSE_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: outcomes('NEGATIVE_RESPONSE'), dtcObservations: Object.freeze([dtc('STORED', 'NEGATIVE_RESPONSE')]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Q-CHECK-001 requires negative response to remain distinct from zero-code success and Response Pending.',
    limitations: Object.freeze(['NRC 0x11 is synthetic; no physical support claim.']),
  }),
  golden({
    caseId: 'golden-malformed-odd-dtc-fails-closed', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('PARSER_FAILURE_SEMANTICS'), evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: MALFORMED_ODD_DTC_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: outcomes('INVALID_RESPONSE'), dtcObservations: Object.freeze([dtc('STORED', 'INVALID_RESPONSE')]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'DTC data is independently specified as byte pairs; an unpaired trailing byte must fail closed.',
    limitations: Object.freeze(['Synthetic malformed edge case.']),
  }),
  golden({
    caseId: 'golden-timeout-bounded-retry', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('ENGINE_CONTROL_FLOW'), evidence: Object.freeze([CHECK_TRANSPORT_CONTRACT]),
    fixture: CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(['TIMEOUT'], 1),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 2, attemptOutcomes: outcomes('TIMEOUT', 'SUCCESS'), dtcObservations: Object.freeze([dtc('STORED', 'TIMEOUT'), dtc('STORED', 'SUCCESS_WITH_CODES', ['P0133'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Bounded retry semantics are fixed by the pre-MK6 transport/planner contract; success payload is separately DTC-tested.',
    limitations: Object.freeze(['No production retry timing is certified.']),
  }),
  golden({
    caseId: 'golden-response-pending-continuation', sourceType: 'VERIFIED_REFERENCE', promotionState: 'GOLDEN',
    claims: scopes('ENGINE_CONTROL_FLOW', 'TRANSPORT_ENVELOPE'), evidence: Object.freeze([ELM327_PENDING_REFERENCE, ELM327_DTC_REFERENCE, CHECK_TRANSPORT_CONTRACT]),
    fixture: CHECK_REPLAY_RESPONSE_PENDING_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile([], 0, 1),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('RESPONSE_PENDING', 'SUCCESS'), dtcObservations: Object.freeze([dtc('STORED', 'RESPONSE_PENDING'), dtc('STORED', 'SUCCESS_WITH_CODES', ['P0133'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Vendor evidence independently defines 7F xx 78 as continuation/wait; no second semantic command is expected.',
    limitations: Object.freeze(['Physical ECU timing and multi-ECU pending behavior remain outside this claim.']),
  }),
  golden({
    caseId: 'golden-disconnect-preserves-terminal-truth', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('ENGINE_CONTROL_FLOW'), evidence: Object.freeze([CHECK_TRANSPORT_CONTRACT]),
    fixture: CHECK_REPLAY_DISCONNECT_KWP, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'DISCONNECTED', commandsIssued: 1, attemptOutcomes: outcomes('DISCONNECTED') }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Transport contract defines disconnect as explicit terminal truth independent of DTC decoding.',
    limitations: Object.freeze(['Synthetic disconnect event; no physical connector timing claim.']),
  }),
  golden({
    caseId: 'golden-can-mode03-count-byte', sourceType: 'VERIFIED_REFERENCE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS', 'TRANSPORT_ENVELOPE'), evidence: Object.freeze([ELM327_DTC_REFERENCE]),
    fixture: CHECK_REPLAY_STORED_SINGLE_CAN, semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('STORED', 'SUCCESS_WITH_CODES', ['P0133'])]) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'Vendor documentation independently states ISO15765/CAN inserts a DTC item-count byte after service 43.',
    limitations: Object.freeze(['Does not certify physical ISO-TP reassembly or a particular CAN vehicle.']),
  }),
  golden({
    caseId: 'golden-mode01-support-bitmap-reference', sourceType: 'SYNTHETIC_EDGE_CASE', promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'), evidence: Object.freeze([ELM327_MODE01_SUPPORT_REFERENCE]),
    fixture: MODE01_SUPPORT_REFERENCE_KWP, semanticIds: Object.freeze(['check.obd.mode01.support.00']), executionProfile: profile(),
    expected: expectation({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), pidSupport: Object.freeze({ command: '0100', advertisedPids: Object.freeze(['0101', '0103', '0104', '0105', '0106', '0107', '010C', '010D', '010E', '010F', '0110', '0111', '0113', '0114', '0115', '011C']), continuationCommand: null }) }),
    reviewedBy: 'CHECK-MK7 evidence review', reviewMethod: 'BE 1F B8 10 comes directly from the vendor 01 00 example and is decoded independently from current parser output.',
    limitations: Object.freeze(['Vendor example transport is unspecified; KWP is only the replay carrier and no physical KWP claim is made.']),
  }),
];

export const CHECK_GOLDEN_REPLAY_CASES_V1: readonly GoldenReplayCase[] = Object.freeze(cases);
