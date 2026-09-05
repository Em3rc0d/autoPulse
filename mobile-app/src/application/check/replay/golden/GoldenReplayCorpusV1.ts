import type { DiagnosticProtocol } from '../../../../domain/diagnostics/DiagnosticConnector';
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
} from './GoldenReplayContract';

export const CHECK_GOLDEN_REPLAY_CORPUS_VERSION = 'check-golden-replay-corpus/v1' as const;

type EnvelopeBaseKey =
  | 'protocol'
  | 'requestService'
  | 'sourceEndpointId'
  | 'observedAt'
  | 'provenance';

type StripEnvelopeBase<T> = T extends DiagnosticServiceEnvelope
  ? Omit<T, EnvelopeBaseKey>
  : never;

type DiagnosticEnvelopeBody = StripEnvelopeBase<DiagnosticServiceEnvelope>;

const scopes = (...values: GoldenReplayClaimScope[]): readonly GoldenReplayClaimScope[] =>
  Object.freeze(values);

const ELM327_DTC_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-DATASHEET-DTC-P34',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf p.35 (PDF index p34): Mode 03 request has no PID; example 43 01 33 00 00 00 00; DTC bytes are paired; 0000 is padding; CAN adds a DTC-count byte.',
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
): DiagnosticReplayScript => ({
  semanticId,
  targetEndpointId: 'ecu-engine',
  events: Object.freeze([{
    kind: 'COMMAND_RESPONSE' as const,
    durationMs: 10,
    observedResponseBytes,
    envelope: envelope(protocol, requestService, 'ecu-engine', START + 10, body),
  }]),
});

const PENDING_ONLY_KWP = fixture('golden-pending-only-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode07.pending-dtc', 'ISO_14230_KWP', '07', {
    kind: 'POSITIVE_RESPONSE', responseService: '47', payload: [0x01, 0x33],
  }, 3),
]);

const PERMANENT_ONLY_KWP = fixture('golden-permanent-only-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode0a.permanent-dtc', 'ISO_14230_KWP', '0A', {
    kind: 'POSITIVE_RESPONSE', responseService: '4A', payload: [0x04, 0x20],
  }, 3),
]);

const NO_DATA_KWP = fixture('golden-no-data-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode03.stored-dtc', 'ISO_14230_KWP', '03', { kind: 'NO_DATA' }, 0),
]);

const NEGATIVE_RESPONSE_KWP = fixture('golden-negative-response-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode03.stored-dtc', 'ISO_14230_KWP', '03', {
    kind: 'NEGATIVE_RESPONSE', negativeResponseCode: '11',
  }, 3),
]);

const MALFORMED_ODD_DTC_KWP = fixture('golden-malformed-odd-dtc-kwp', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode03.stored-dtc', 'ISO_14230_KWP', '03', {
    kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01],
  }, 2),
]);

const MODE01_SUPPORT_REFERENCE_KWP = fixture('golden-mode01-support-00-reference-shape', 'ISO_14230_KWP', [
  oneEvent('check.obd.mode01.support.00', 'ISO_14230_KWP', '01', {
    kind: 'POSITIVE_RESPONSE', responseService: '41', payload: [0x00, 0xBE, 0x1F, 0xB8, 0x10],
  }, 6),
]);

const profile = (
  retryableOutcomes: readonly ('TIMEOUT' | 'NO_DATA' | 'FAILED')[] = [],
  maxRetries = 0,
  maxPendingExtensions = 1,
) => Object.freeze({
  retryableOutcomes,
  maxRetries,
  maxPendingExtensions,
  minInterCommandDelayMs: 0,
});

const cases: GoldenReplayCase[] = [
  {
    caseId: 'golden-legacy-mode03-p0133',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'),
    evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_STORED_SINGLE_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: Object.freeze(['SUCCESS']),
      dtcObservations: Object.freeze([{ status: 'STORED', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Expected DTC pair and padding semantics derived from ELM327 vendor example, not from parser output; KWP transport selection remains synthetic.',
    limitations: Object.freeze(['Does not certify a physical KWP vehicle response shape.']),
  },
  {
    caseId: 'golden-zero-dtc-core',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS', 'PARSER_FAILURE_SEMANTICS'),
    evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_ZERO_DTC_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc', 'check.obd.mode07.pending-dtc', 'check.obd.mode0a.permanent-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 3, attemptOutcomes: Object.freeze(['SUCCESS', 'SUCCESS', 'SUCCESS']),
      dtcObservations: Object.freeze([
        { status: 'STORED', outcome: 'SUCCESS_ZERO_CODES', codes: Object.freeze([]) },
        { status: 'PENDING', outcome: 'SUCCESS_ZERO_CODES', codes: Object.freeze([]) },
        { status: 'PERMANENT', outcome: 'SUCCESS_ZERO_CODES', codes: Object.freeze([]) },
      ]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Zero-code expectations follow explicit 0000-padding/non-code semantics plus pre-parser Q-CHECK-001 result semantics.',
    limitations: Object.freeze(['Synthetic zero-result shape; not physical vehicle evidence.']),
  },
  {
    caseId: 'golden-pending-only',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'),
    evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: PENDING_ONLY_KWP,
    semanticIds: Object.freeze(['check.obd.mode07.pending-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: Object.freeze(['SUCCESS']),
      dtcObservations: Object.freeze([{ status: 'PENDING', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Status mapping is fixed by the pre-parser Q-CHECK-001 service contract; payload uses independently reviewed P0133 pair semantics.',
    limitations: Object.freeze(['Mode 07 physical transport envelope remains unclaimed.']),
  },
  {
    caseId: 'golden-permanent-only',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'),
    evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: PERMANENT_ONLY_KWP,
    semanticIds: Object.freeze(['check.obd.mode0a.permanent-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: Object.freeze(['SUCCESS']),
      dtcObservations: Object.freeze([{ status: 'PERMANENT', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0420']) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Permanent status mapping is fixed by Q-CHECK-001; payload is a synthetic edge case reviewed independently from parser output.',
    limitations: Object.freeze(['Mode 0A physical transport envelope remains unclaimed.']),
  },
  {
    caseId: 'golden-same-code-multi-status',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'),
    evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_MULTI_STATUS_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc', 'check.obd.mode07.pending-dtc', 'check.obd.mode0a.permanent-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 3, attemptOutcomes: Object.freeze(['SUCCESS', 'SUCCESS', 'SUCCESS']),
      dtcObservations: Object.freeze([
        { status: 'STORED', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) },
        { status: 'PENDING', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) },
        { status: 'PERMANENT', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0420']) },
      ]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Regression of the pre-parser invariant that code de-duplication may not erase status observations.',
    limitations: Object.freeze(['Synthetic status-combination case.']),
  },
  {
    caseId: 'golden-no-data-is-not-zero',
    sourceType: 'VERIFIED_REFERENCE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS', 'ENGINE_CONTROL_FLOW'),
    evidence: Object.freeze([ELM327_NO_DATA_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: NO_DATA_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: Object.freeze(['NO_DATA']),
      dtcObservations: Object.freeze([{ status: 'STORED', outcome: 'NO_DATA', codes: Object.freeze([]) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'ELM vendor documentation independently defines NO DATA as absence of an acceptable response, not numeric zero.',
    limitations: Object.freeze(['Does not certify why a particular physical vehicle produced NO DATA.']),
  },
  {
    caseId: 'golden-negative-response-distinct',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('PARSER_FAILURE_SEMANTICS'),
    evidence: Object.freeze([ELM327_PENDING_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: NEGATIVE_RESPONSE_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: Object.freeze(['NEGATIVE_RESPONSE']),
      dtcObservations: Object.freeze([{ status: 'STORED', outcome: 'NEGATIVE_RESPONSE', codes: Object.freeze([]) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Negative response remains distinct from NRC 0x78 Response Pending and from zero-code success.',
    limitations: Object.freeze(['NRC 0x11 is synthetic; no physical support claim.']),
  },
  {
    caseId: 'golden-malformed-odd-dtc-fails-closed',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('PARSER_FAILURE_SEMANTICS'),
    evidence: Object.freeze([ELM327_DTC_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: MALFORMED_ODD_DTC_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'LIMITED', commandsIssued: 1, attemptOutcomes: Object.freeze(['INVALID_RESPONSE']),
      dtcObservations: Object.freeze([{ status: 'STORED', outcome: 'INVALID_RESPONSE', codes: Object.freeze([]) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'ELM vendor example states DTC data is interpreted in two-byte pairs; one trailing byte is therefore invalid rather than a code.',
    limitations: Object.freeze(['Synthetic malformed edge case.']),
  },
  {
    caseId: 'golden-timeout-bounded-retry',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('ENGINE_CONTROL_FLOW'),
    evidence: Object.freeze([ELM327_NO_DATA_REFERENCE, CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(['TIMEOUT'], 1),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 2, attemptOutcomes: Object.freeze(['TIMEOUT', 'SUCCESS']),
      dtcObservations: Object.freeze([
        { status: 'STORED', outcome: 'TIMEOUT', codes: Object.freeze([]) },
        { status: 'STORED', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) },
      ]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Retry is an AutoPulse policy edge case; expected command count derives from the pre-execution retry/budget contract, not parser output.',
    limitations: Object.freeze(['No production retry timing is certified.']),
  },
  {
    caseId: 'golden-response-pending-continuation',
    sourceType: 'VERIFIED_REFERENCE',
    promotionState: 'GOLDEN',
    claims: scopes('ENGINE_CONTROL_FLOW', 'TRANSPORT_ENVELOPE'),
    evidence: Object.freeze([ELM327_PENDING_REFERENCE, ELM327_DTC_REFERENCE]),
    fixture: CHECK_REPLAY_RESPONSE_PENDING_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile([], 0, 1),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: Object.freeze(['RESPONSE_PENDING', 'SUCCESS']),
      dtcObservations: Object.freeze([
        { status: 'STORED', outcome: 'RESPONSE_PENDING', codes: Object.freeze([]) },
        { status: 'STORED', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) },
      ]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'ELM vendor documentation independently defines 7F xx 78 for KWP/CAN as wait/continuation behavior; follow-up payload reuses the independently documented P0133 example.',
    limitations: Object.freeze(['Physical ECU timing and multi-ECU pending behavior remain outside this claim.']),
  },
  {
    caseId: 'golden-disconnect-preserves-terminal-truth',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('ENGINE_CONTROL_FLOW'),
    evidence: Object.freeze([CHECK_DTC_CONTRACT]),
    fixture: CHECK_REPLAY_DISCONNECT_KWP,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({ terminalState: 'DISCONNECTED', commandsIssued: 1, attemptOutcomes: Object.freeze(['DISCONNECTED']) }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Terminal disconnect behavior is fixed by the pre-parser Check scan-state contract and is intentionally independent of DTC decoding.',
    limitations: Object.freeze(['Synthetic disconnect event; no physical connector timing claim.']),
  },
  {
    caseId: 'golden-can-mode03-count-byte',
    sourceType: 'VERIFIED_REFERENCE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS', 'TRANSPORT_ENVELOPE'),
    evidence: Object.freeze([ELM327_DTC_REFERENCE]),
    fixture: CHECK_REPLAY_STORED_SINGLE_CAN,
    semanticIds: Object.freeze(['check.obd.mode03.stored-dtc']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: Object.freeze(['SUCCESS']),
      dtcObservations: Object.freeze([{ status: 'STORED', outcome: 'SUCCESS_WITH_CODES', codes: Object.freeze(['P0133']) }]),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'ELM vendor documentation independently states ISO15765/CAN adds a DTC item-count byte after service 43; P0133 pair comes from the same documented example.',
    limitations: Object.freeze(['Does not certify physical ISO-TP reassembly or a particular CAN vehicle.']),
  },
  {
    caseId: 'golden-mode01-support-bitmap-reference',
    sourceType: 'SYNTHETIC_EDGE_CASE',
    promotionState: 'GOLDEN',
    claims: scopes('SERVICE_SEMANTICS'),
    evidence: Object.freeze([ELM327_MODE01_SUPPORT_REFERENCE]),
    fixture: MODE01_SUPPORT_REFERENCE_KWP,
    semanticIds: Object.freeze(['check.obd.mode01.support.00']),
    executionProfile: profile(),
    expected: Object.freeze({
      terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: Object.freeze(['SUCCESS']),
      pidSupport: Object.freeze({
        command: '0100',
        advertisedPids: Object.freeze(['0101', '0103', '0104', '0105', '0106', '0107', '010C', '010D', '010E', '010F', '0110', '0111', '0113', '0114', '0115', '011C']),
        continuationCommand: null,
      }),
    }),
    reviewedBy: 'CHECK-MK7 evidence review',
    reviewMethod: 'Raw data bytes are copied from the ELM327 vendor example and decoded independently from the current parser contract; KWP protocol selection is only a replay carrier.',
    limitations: Object.freeze(['The ELM example does not identify the vehicle transport as KWP; no physical KWP support claim is made.']),
  },
];

export const CHECK_GOLDEN_REPLAY_CASES_V1: readonly GoldenReplayCase[] = Object.freeze(cases);
