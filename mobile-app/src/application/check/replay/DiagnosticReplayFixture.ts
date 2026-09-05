import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticServiceEnvelope } from '../parsers/DiagnosticServiceEnvelope';

export type DiagnosticReplayEventKind = 'COMMAND_RESPONSE' | 'PENDING_CONTINUATION';

export interface DiagnosticReplayObservedResponse {
  readonly observedResponseBytes: number;
  readonly envelope: DiagnosticServiceEnvelope;
}

interface DiagnosticReplayEventBase {
  readonly kind: DiagnosticReplayEventKind;
  /** Deterministic elapsed time between event start and the completed response set. */
  readonly durationMs: number;
}

export interface DiagnosticReplaySingleResponseEvent extends DiagnosticReplayEventBase {
  readonly observedResponseBytes: number;
  readonly envelope: DiagnosticServiceEnvelope;
  readonly responses?: never;
}

export interface DiagnosticReplayMultiResponseEvent extends DiagnosticReplayEventBase {
  /**
   * Normalized complete responses produced by one semantic request. This is
   * how functional OBD multi-ECU replies are represented without issuing
   * hidden additional commands.
   */
  readonly responses: readonly DiagnosticReplayObservedResponse[];
  readonly observedResponseBytes?: never;
  readonly envelope?: never;
}

export type DiagnosticReplayEvent =
  | DiagnosticReplaySingleResponseEvent
  | DiagnosticReplayMultiResponseEvent;

export interface DiagnosticReplayScript {
  readonly semanticId: string;
  readonly targetEndpointId: string | null;
  readonly events: readonly DiagnosticReplayEvent[];
}

export interface DiagnosticReplayFixture {
  readonly fixtureId: string;
  readonly protocol: DiagnosticProtocol;
  readonly provenance: string;
  readonly startedAt: number;
  readonly scripts: readonly DiagnosticReplayScript[];
}

export function diagnosticReplayScriptKey(
  semanticId: string,
  targetEndpointId: string | null,
): string {
  return `${semanticId.trim()}::${targetEndpointId ?? 'FUNCTIONAL_OR_UNATTRIBUTED'}`;
}

export function diagnosticReplayEventResponses(
  event: DiagnosticReplayEvent,
): readonly DiagnosticReplayObservedResponse[] {
  if ('responses' in event && event.responses !== undefined) {
    return event.responses;
  }
  return Object.freeze([{
    envelope: event.envelope,
    observedResponseBytes: event.observedResponseBytes,
  }]);
}

function eventContainsResponsePending(event: DiagnosticReplayEvent): boolean {
  return diagnosticReplayEventResponses(event).some(response =>
    response.envelope.kind === 'NEGATIVE_RESPONSE'
      && response.envelope.negativeResponseCode.trim().toUpperCase() === '78',
  );
}

export function assertValidDiagnosticReplayFixture(fixture: DiagnosticReplayFixture): void {
  if (!fixture.fixtureId.trim()) throw new Error('Replay fixtureId must be non-empty');
  if (!fixture.provenance.trim()) throw new Error('Replay fixture provenance must be non-empty');
  if (!Number.isFinite(fixture.startedAt) || fixture.startedAt < 0) throw new Error('Replay fixture startedAt must be finite and non-negative');
  if (fixture.protocol === 'UNKNOWN' || fixture.protocol === 'UDS') {
    throw new Error(`Replay fixture protocol ${fixture.protocol} is outside Check Core V1`);
  }
  if (fixture.scripts.length === 0) throw new Error('Replay fixture must contain at least one script');

  const keys = new Set<string>();
  for (const script of fixture.scripts) {
    if (!script.semanticId.trim()) throw new Error('Replay script semanticId must be non-empty');
    if (script.targetEndpointId !== null && !script.targetEndpointId.trim()) {
      throw new Error(`Replay script ${script.semanticId} targetEndpointId must be non-empty when attributed`);
    }
    if (script.events.length === 0) throw new Error(`Replay script ${script.semanticId} must contain at least one event`);
    if (script.events[0].kind !== 'COMMAND_RESPONSE') {
      throw new Error(`Replay script ${script.semanticId} must begin with COMMAND_RESPONSE`);
    }

    const key = diagnosticReplayScriptKey(script.semanticId, script.targetEndpointId);
    if (keys.has(key)) throw new Error(`Duplicate replay script key: ${key}`);
    keys.add(key);

    script.events.forEach((event, eventIndex) => {
      if (!Number.isInteger(event.durationMs) || event.durationMs < 0) {
        throw new Error(`Replay event durationMs must be a non-negative integer for ${key}`);
      }
      if (event.kind === 'PENDING_CONTINUATION') {
        const previous = script.events[eventIndex - 1];
        if (!previous || !eventContainsResponsePending(previous)) {
          throw new Error(`Replay pending continuation for ${key} requires a preceding Response Pending event`);
        }
      }

      const responses = diagnosticReplayEventResponses(event);
      if (responses.length === 0) {
        throw new Error(`Replay event must preserve at least one response for ${key}`);
      }

      const attributedResponders = new Set<string>();
      for (const response of responses) {
        if (!Number.isInteger(response.observedResponseBytes) || response.observedResponseBytes < 0) {
          throw new Error(`Replay observedResponseBytes must be a non-negative integer for ${key}`);
        }
        if (response.envelope.protocol !== fixture.protocol) {
          throw new Error(`Replay envelope protocol mismatch for ${key}`);
        }
        if (!response.envelope.requestService.trim()) {
          throw new Error(`Replay envelope requestService must be non-empty for ${key}`);
        }
        if (!Number.isFinite(response.envelope.observedAt) || response.envelope.observedAt < 0) {
          throw new Error(`Replay envelope observedAt must be finite and non-negative for ${key}`);
        }
        if (!response.envelope.provenance.trim()) {
          throw new Error(`Replay envelope provenance must be non-empty for ${key}`);
        }
        if (response.envelope.sourceEndpointId !== null) {
          const source = response.envelope.sourceEndpointId.trim();
          if (!source) throw new Error(`Replay attributed sourceEndpointId must be non-empty for ${key}`);
          if (attributedResponders.has(source)) {
            throw new Error(`Replay event contains duplicate normalized responder ${source} for ${key}`);
          }
          attributedResponders.add(source);
        }
      }
    });
  }
}
