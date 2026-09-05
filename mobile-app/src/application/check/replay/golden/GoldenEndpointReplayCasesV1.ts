import type { DiagnosticAttemptOutcome } from '../../planner/RetryPolicy';
import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import type { DiagnosticReplayFixture, DiagnosticReplayObservedResponse } from '../DiagnosticReplayFixture';
import type {
  GoldenReplayCase,
  GoldenReplayClaimScope,
  GoldenReplayEvidenceRef,
  GoldenReplayExpectation,
  GoldenReplayExpectedDtcObservation,
} from './GoldenReplayContract';

type EnvelopeBaseKey = 'protocol' | 'requestService' | 'sourceEndpointId' | 'observedAt' | 'provenance';
type StripEnvelopeBase<T> = T extends DiagnosticServiceEnvelope ? Omit<T, EnvelopeBaseKey> : never;
type DiagnosticEnvelopeBody = StripEnvelopeBase<DiagnosticServiceEnvelope>;

const START = 3000;
const SEMANTIC = 'check.obd.mode03.stored-dtc';
const scopes = (...values: GoldenReplayClaimScope[]): readonly GoldenReplayClaimScope[] => Object.freeze(values);
const outcomes = (...values: DiagnosticAttemptOutcome[]): readonly DiagnosticAttemptOutcome[] => Object.freeze(values);
const dtc = (outcome: GoldenReplayExpectedDtcObservation['outcome'], codes: readonly string[], sourceEndpointId: string | null): GoldenReplayExpectedDtcObservation =>
  Object.freeze({ status: 'STORED', outcome, codes: Object.freeze([...codes]), sourceEndpointId });
const expected = (value: GoldenReplayExpectation): GoldenReplayExpectation => Object.freeze(value);
const golden = (value: GoldenReplayCase): GoldenReplayCase => Object.freeze(value);

const ENDPOINT_CONTRACT: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'Q-CHECK-001-ENDPOINT-ATTRIBUTION',
  kind: 'REPOSITORY_CONTRACT',
  locator: 'Q-CHECK-001: functional OBD requests may receive several ECU replies; source is attributed only when source evidence exists, otherwise UNATTRIBUTED.',
  supports: scopes('ENDPOINT_ATTRIBUTION', 'SERVICE_SEMANTICS'),
  independentFromParserOutput: true,
});

const TRANSPORT_CONTRACT: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'Q-CHECK-011-MULTI-RESPONDER',
  kind: 'REPOSITORY_CONTRACT',
  locator: 'Q-CHECK-011: one functional OBD request may produce one or several ECU responses; ambiguous source identity must degrade rather than be guessed.',
  supports: scopes('ENDPOINT_ATTRIBUTION', 'ENGINE_CONTROL_FLOW'),
  independentFromParserOutput: true,
});

function response(
  sourceEndpointId: string | null,
  body: DiagnosticEnvelopeBody,
  bytes: number,
  provenance: string,
): DiagnosticReplayObservedResponse {
  const envelope = {
    ...body,
    requestService: '03',
    protocol: 'ISO_14230_KWP',
    sourceEndpointId,
    provenance,
    observedAt: START + 10,
  } as DiagnosticServiceEnvelope;
  return Object.freeze({ envelope, observedResponseBytes: bytes });
}

const positive = (sourceEndpointId: string | null, payload: readonly number[], provenance: string): DiagnosticReplayObservedResponse =>
  response(sourceEndpointId, { kind: 'POSITIVE_RESPONSE', responseService: '43', payload }, 3, provenance);
const noData = (sourceEndpointId: string | null, provenance: string): DiagnosticReplayObservedResponse =>
  response(sourceEndpointId, { kind: 'NO_DATA' }, 0, provenance);

function fixture(fixtureId: string, responses: readonly DiagnosticReplayObservedResponse[]): DiagnosticReplayFixture {
  return Object.freeze({
    fixtureId,
    protocol: 'ISO_14230_KWP',
    provenance: `check-golden-endpoint/v1:${fixtureId}:SYNTHETIC_NOT_PHYSICAL_CERTIFICATION`,
    startedAt: START,
    scripts: Object.freeze([{
      semanticId: SEMANTIC,
      targetEndpointId: null,
      events: Object.freeze([{ kind: 'COMMAND_RESPONSE' as const, durationMs: 10, responses: Object.freeze([...responses]) }]),
    }]),
  });
}

const SINGLE_ATTRIBUTED = fixture('single-attributed', [positive('ecu-a', [0x01, 0x33], 'synthetic:attributed')]);
const MULTI_ATTRIBUTED = fixture('multi-attributed', [
  positive('ecu-a', [0x01, 0x33], 'synthetic:multi:ecu-a'),
  positive('ecu-b', [0x04, 0x20], 'synthetic:multi:ecu-b'),
]);
const UNATTRIBUTED = fixture('unattributed', [positive(null, [0x01, 0x33], 'synthetic:headers-unavailable')]);
const AMBIGUOUS_SOURCE = fixture('source-ambiguous', [positive(null, [0x04, 0x20], 'synthetic:response-source-ambiguous')]);
const MIXED = fixture('mixed-responder-outcomes', [
  positive('ecu-a', [0x01, 0x33], 'synthetic:mixed:ecu-a'),
  noData('ecu-b', 'synthetic:mixed:ecu-b'),
]);

const base = {
  sourceType: 'SYNTHETIC_EDGE_CASE' as const,
  promotionState: 'GOLDEN' as const,
  claims: scopes('ENDPOINT_ATTRIBUTION'),
  evidence: Object.freeze([ENDPOINT_CONTRACT, TRANSPORT_CONTRACT]),
  semanticIds: Object.freeze([SEMANTIC]),
  executionProfile: Object.freeze({ retryableOutcomes: Object.freeze([]), maxRetries: 0, maxPendingExtensions: 1, minInterCommandDelayMs: 0 }),
  reviewedBy: 'CHECK-MK7 endpoint evidence review',
};

export const CHECK_GOLDEN_ENDPOINT_CASES_V1: readonly GoldenReplayCase[] = Object.freeze([
  golden({
    ...base,
    caseId: 'golden-attributed-single-responder',
    fixture: SINGLE_ATTRIBUTED,
    expected: expected({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('SUCCESS_WITH_CODES', ['P0133'], 'ecu-a')]) }),
    reviewMethod: 'Functional target is not pre-attributed; the normalized response carries ecu-a source evidence and must preserve it.',
    limitations: Object.freeze(['Synthetic endpoint identity; no physical address-to-module-role claim.']),
  }),
  golden({
    ...base,
    caseId: 'golden-multi-responder-attributed',
    fixture: MULTI_ATTRIBUTED,
    expected: expected({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS', 'SUCCESS'), dtcObservations: Object.freeze([
      dtc('SUCCESS_WITH_CODES', ['P0133'], 'ecu-a'),
      dtc('SUCCESS_WITH_CODES', ['P0420'], 'ecu-b'),
    ]) }),
    reviewMethod: 'Two responder envelopes belong to one functional semantic command; both endpoint-attributed DTC observations must survive while commandsIssued remains one.',
    limitations: Object.freeze(['Synthetic multi-responder set; does not certify physical addressing/filter behavior.']),
  }),
  golden({
    ...base,
    caseId: 'golden-unattributed-response',
    fixture: UNATTRIBUTED,
    expected: expected({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('SUCCESS_WITH_CODES', ['P0133'], null)]) }),
    reviewMethod: 'When headers/source evidence are absent, a valid DTC observation remains usable but sourceEndpointId must stay null.',
    limitations: Object.freeze(['UNATTRIBUTED is deliberate evidence truth, not an engine-module guess.']),
  }),
  golden({
    ...base,
    caseId: 'golden-source-ambiguity-stays-unattributed',
    fixture: AMBIGUOUS_SOURCE,
    expected: expected({ terminalState: 'COMPLETE', commandsIssued: 1, attemptOutcomes: outcomes('SUCCESS'), dtcObservations: Object.freeze([dtc('SUCCESS_WITH_CODES', ['P0420'], null)]) }),
    reviewMethod: 'Response-level source ambiguity is normalized to null source identity; the engine must never manufacture a role/address.',
    limitations: Object.freeze(['Ambiguity provenance is synthetic; the asserted behavior is fail-closed attribution.']),
  }),
  golden({
    ...base,
    caseId: 'golden-mixed-responder-outcomes-limited',
    claims: scopes('ENDPOINT_ATTRIBUTION', 'ENGINE_CONTROL_FLOW'),
    fixture: MIXED,
    expected: expected({
      terminalState: 'LIMITED',
      commandsIssued: 1,
      attemptOutcomes: outcomes('SUCCESS', 'NO_DATA'),
      dtcObservations: Object.freeze([
        dtc('SUCCESS_WITH_CODES', ['P0133'], 'ecu-a'),
        dtc('NO_DATA', [], 'ecu-b'),
      ]),
      limitationsContain: Object.freeze([`mixed-responder-outcomes:${SEMANTIC}`]),
    }),
    reviewMethod: 'A successful ECU response plus another responder failure is PARTIAL transaction coverage: retain good evidence, do not call the request fully successful, and do not issue a hidden duplicate command.',
    limitations: Object.freeze(['Synthetic mixed outcome; production retry/timing remains outside this claim.']),
  }),
]);
