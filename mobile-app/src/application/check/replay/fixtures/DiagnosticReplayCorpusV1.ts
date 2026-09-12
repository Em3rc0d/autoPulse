import type { DiagnosticProtocol } from '../../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticServiceEnvelope } from '../../parsers/DiagnosticServiceEnvelope';
import type { DiagnosticReplayFixture, DiagnosticReplayScript } from '../DiagnosticReplayFixture';

export const CHECK_REPLAY_CORPUS_VERSION = 'check-replay-corpus/synthetic-v1' as const;

const START = 1000;

type ReplayEnvelopeBody =
  | { readonly kind: 'POSITIVE_RESPONSE'; readonly responseService: string; readonly payload: readonly number[]; readonly rawText?: string }
  | { readonly kind: 'NEGATIVE_RESPONSE'; readonly negativeResponseCode: string; readonly rawText?: string }
  | { readonly kind: 'NO_DATA'; readonly rawText?: string }
  | { readonly kind: 'TIMEOUT'; readonly rawText?: string }
  | { readonly kind: 'DISCONNECTED'; readonly rawText?: string }
  | { readonly kind: 'UNSUPPORTED'; readonly rawText?: string }
  | { readonly kind: 'FAILED'; readonly detail?: string; readonly rawText?: string }
  | { readonly kind: 'PARTIAL'; readonly responseService?: string; readonly payload?: readonly number[]; readonly detail?: string; readonly rawText?: string }
  | { readonly kind: 'INVALID_RESPONSE'; readonly detail?: string; readonly rawText?: string };

const envelope = (
  protocol: DiagnosticProtocol,
  requestService: string,
  sourceEndpointId: string | null,
  observedAt: number,
  body: ReplayEnvelopeBody,
): DiagnosticServiceEnvelope => ({
  ...body,
  protocol,
  requestService,
  sourceEndpointId,
  observedAt,
  provenance: `${CHECK_REPLAY_CORPUS_VERSION}:synthetic-contract`,
} as DiagnosticServiceEnvelope);

const script = (
  semanticId: string,
  events: DiagnosticReplayScript['events'],
  targetEndpointId: string | null = 'ecu-engine',
): DiagnosticReplayScript => ({ semanticId, targetEndpointId, events });

const fixture = (
  fixtureId: string,
  protocol: DiagnosticProtocol,
  scripts: readonly DiagnosticReplayScript[],
): DiagnosticReplayFixture => Object.freeze({
  fixtureId,
  protocol,
  provenance: `${CHECK_REPLAY_CORPUS_VERSION}:SYNTHETIC_NOT_PHYSICAL_CERTIFICATION`,
  startedAt: START,
  scripts: Object.freeze([...scripts]),
});

export const CHECK_REPLAY_ZERO_DTC_KWP = fixture(
  'zero-dtc-kwp',
  'ISO_14230_KWP',
  [
    script('check.obd.mode03.stored-dtc', [{
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1010, {
        kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x00, 0x00],
      }),
    }]),
    script('check.obd.mode07.pending-dtc', [{
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '07', 'ecu-engine', 1020, {
        kind: 'POSITIVE_RESPONSE', responseService: '47', payload: [0x00, 0x00],
      }),
    }]),
    script('check.obd.mode0a.permanent-dtc', [{
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '0A', 'ecu-engine', 1030, {
        kind: 'POSITIVE_RESPONSE', responseService: '4A', payload: [0x00, 0x00],
      }),
    }]),
  ],
);

export const CHECK_REPLAY_STORED_SINGLE_KWP = fixture(
  'stored-single-kwp',
  'ISO_14230_KWP',
  [script('check.obd.mode03.stored-dtc', [{
    kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
    envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1010, {
      kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x33],
    }),
  }])],
);

export const CHECK_REPLAY_MULTI_STATUS_KWP = fixture(
  'same-dtc-multi-status-kwp',
  'ISO_14230_KWP',
  [
    script('check.obd.mode03.stored-dtc', [{
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1010, {
        kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x33],
      }),
    }]),
    script('check.obd.mode07.pending-dtc', [{
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '07', 'ecu-engine', 1020, {
        kind: 'POSITIVE_RESPONSE', responseService: '47', payload: [0x01, 0x33],
      }),
    }]),
    script('check.obd.mode0a.permanent-dtc', [{
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '0A', 'ecu-engine', 1030, {
        kind: 'POSITIVE_RESPONSE', responseService: '4A', payload: [0x04, 0x20],
      }),
    }]),
  ],
);

export const CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP = fixture(
  'timeout-then-success-kwp',
  'ISO_14230_KWP',
  [script('check.obd.mode03.stored-dtc', [
    {
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 0,
      envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1010, { kind: 'TIMEOUT' }),
    },
    {
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1020, {
        kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x33],
      }),
    },
  ])],
);

export const CHECK_REPLAY_RESPONSE_PENDING_KWP = fixture(
  'response-pending-kwp',
  'ISO_14230_KWP',
  [script('check.obd.mode03.stored-dtc', [
    {
      kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1010, {
        kind: 'NEGATIVE_RESPONSE', negativeResponseCode: '78',
      }),
    },
    {
      kind: 'PENDING_CONTINUATION', durationMs: 50, observedResponseBytes: 3,
      envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1060, {
        kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x33],
      }),
    },
  ])],
);

export const CHECK_REPLAY_DISCONNECT_KWP = fixture(
  'disconnect-kwp',
  'ISO_14230_KWP',
  [script('check.obd.mode03.stored-dtc', [{
    kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 0,
    envelope: envelope('ISO_14230_KWP', '03', 'ecu-engine', 1010, { kind: 'DISCONNECTED' }),
  }])],
);

export const CHECK_REPLAY_STORED_SINGLE_CAN = fixture(
  'stored-single-can',
  'ISO_15765_CAN',
  [script('check.obd.mode03.stored-dtc', [{
    kind: 'COMMAND_RESPONSE', durationMs: 10, observedResponseBytes: 4,
    envelope: envelope('ISO_15765_CAN', '03', 'ecu-engine', 1010, {
      kind: 'POSITIVE_RESPONSE', responseService: '43', payload: [0x01, 0x01, 0x33],
    }),
  }])],
);

export const CHECK_REPLAY_CORPUS_V1: readonly DiagnosticReplayFixture[] = Object.freeze([
  CHECK_REPLAY_ZERO_DTC_KWP,
  CHECK_REPLAY_STORED_SINGLE_KWP,
  CHECK_REPLAY_MULTI_STATUS_KWP,
  CHECK_REPLAY_TIMEOUT_THEN_SUCCESS_KWP,
  CHECK_REPLAY_RESPONSE_PENDING_KWP,
  CHECK_REPLAY_DISCONNECT_KWP,
  CHECK_REPLAY_STORED_SINGLE_CAN,
]);
