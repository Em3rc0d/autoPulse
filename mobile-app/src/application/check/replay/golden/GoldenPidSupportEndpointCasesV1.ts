import type { DiagnosticAttemptOutcome } from '../../planner/RetryPolicy';
import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import type {
  DiagnosticReplayFixture,
  DiagnosticReplayObservedResponse,
} from '../DiagnosticReplayFixture';
import type {
  GoldenReplayCase,
  GoldenReplayClaimScope,
  GoldenReplayEvidenceRef,
  GoldenReplayExpectation,
  GoldenReplayExpectedPidSupportObservation,
} from './GoldenReplayContract';

const START = 5000;
const SEMANTIC = 'check.obd.mode01.support.00';
const scopes = (...values: GoldenReplayClaimScope[]): readonly GoldenReplayClaimScope[] => Object.freeze(values);
const outcomes = (...values: DiagnosticAttemptOutcome[]): readonly DiagnosticAttemptOutcome[] => Object.freeze(values);
const expected = (value: GoldenReplayExpectation): GoldenReplayExpectation => Object.freeze(value);
const golden = (value: GoldenReplayCase): GoldenReplayCase => Object.freeze(value);
const pid = (
  advertisedPids: readonly string[],
  continuationCommand: string | null,
  sourceEndpointId: string | null,
): GoldenReplayExpectedPidSupportObservation => Object.freeze({
  command: '0100', advertisedPids: Object.freeze([...advertisedPids]), continuationCommand, sourceEndpointId,
});

const PID_CONTRACT: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'Q-CHECK-002-ENDPOINT-PID-CAPABILITY',
  kind: 'REPOSITORY_CONTRACT',
  locator: 'Q-CHECK-002: supported-PID bitmaps are capability evidence scoped to the ECU/responding endpoint; vehicle-global union is forbidden.',
  supports: scopes('SERVICE_SEMANTICS', 'ENDPOINT_ATTRIBUTION'),
  independentFromParserOutput: true,
});

const ELM_REFERENCE: GoldenReplayEvidenceRef = Object.freeze({
  evidenceId: 'SRC-ELM327-0100-BITMAP',
  kind: 'VENDOR_TECHNICAL_REFERENCE',
  locator: 'ELM327DS.pdf 01 00 example: response 41 00 is followed by exactly four supported-PID bitmap bytes.',
  supports: scopes('SERVICE_SEMANTICS'),
  independentFromParserOutput: true,
});

function response(
  sourceEndpointId: string | null,
  bitmap: readonly [number, number, number, number],
  provenance: string,
): DiagnosticReplayObservedResponse {
  const envelope: DiagnosticServiceEnvelope = {
    kind: 'POSITIVE_RESPONSE',
    requestService: '01',
    responseService: '41',
    payload: [0x00, ...bitmap],
    protocol: 'ISO_14230_KWP',
    sourceEndpointId,
    provenance,
    observedAt: START + 10,
  };
  return Object.freeze({ envelope, observedResponseBytes: 6 });
}

function fixture(fixtureId: string, responses: readonly DiagnosticReplayObservedResponse[]): DiagnosticReplayFixture {
  return Object.freeze({
    fixtureId,
    protocol: 'ISO_14230_KWP',
    provenance: `check-golden-pid-endpoint/v1:${fixtureId}:SYNTHETIC_NOT_PHYSICAL_CERTIFICATION`,
    startedAt: START,
    scripts: Object.freeze([{
      semanticId: SEMANTIC,
      targetEndpointId: null,
      events: Object.freeze([{ kind: 'COMMAND_RESPONSE' as const, durationMs: 10, responses: Object.freeze([...responses]) }]),
    }]),
  });
}

const MULTI = fixture('mode01-support-multi-endpoint', [
  // ECU A advertises PID 01 and the continuation bitmap PID 20.
  response('ecu-a', [0x80, 0x00, 0x00, 0x01], 'synthetic:pid-support:ecu-a'),
  // ECU B advertises only PID 02 and does not announce another block.
  response('ecu-b', [0x40, 0x00, 0x00, 0x00], 'synthetic:pid-support:ecu-b'),
]);

const UNATTRIBUTED = fixture('mode01-support-unattributed', [
  response(null, [0x80, 0x00, 0x00, 0x00], 'synthetic:pid-support:unattributed'),
]);

const base = {
  sourceType: 'SYNTHETIC_EDGE_CASE' as const,
  promotionState: 'GOLDEN' as const,
  claims: scopes('SERVICE_SEMANTICS', 'ENDPOINT_ATTRIBUTION'),
  evidence: Object.freeze([PID_CONTRACT, ELM_REFERENCE]),
  semanticIds: Object.freeze([SEMANTIC]),
  executionProfile: Object.freeze({ retryableOutcomes: Object.freeze([]), maxRetries: 0, maxPendingExtensions: 1, minInterCommandDelayMs: 0 }),
  reviewedBy: 'CHECK-MK9 PID capability evidence review',
};

export const CHECK_GOLDEN_PID_SUPPORT_ENDPOINT_CASES_V1: readonly GoldenReplayCase[] = Object.freeze([
  golden({
    ...base,
    caseId: 'golden-pid-support-multi-endpoint',
    fixture: MULTI,
    expected: expected({
      terminalState: 'COMPLETE',
      commandsIssued: 1,
      attemptOutcomes: outcomes('SUCCESS', 'SUCCESS'),
      pidSupportObservations: Object.freeze([
        pid(['0101', '0120'], '0120', 'ecu-a'),
        pid(['0102'], null, 'ecu-b'),
      ]),
    }),
    reviewMethod: 'One functional 0100 request yields two independently attributed capability maps; no vehicle-global PID union is allowed.',
    limitations: Object.freeze(['Synthetic endpoint identifiers; no physical KWP timing/address claim.']),
  }),
  golden({
    ...base,
    caseId: 'golden-pid-support-unattributed-stays-unattributed',
    fixture: UNATTRIBUTED,
    expected: expected({
      terminalState: 'COMPLETE',
      commandsIssued: 1,
      attemptOutcomes: outcomes('SUCCESS'),
      pidSupportObservations: Object.freeze([
        pid(['0101'], null, null),
      ]),
    }),
    reviewMethod: 'A valid support bitmap without source evidence remains usable but unattributed; the engine may not assign it to a guessed ECU.',
    limitations: Object.freeze(['Synthetic unattributed capability evidence.']),
  }),
]);
