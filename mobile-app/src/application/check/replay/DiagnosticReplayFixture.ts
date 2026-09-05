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

export function assertValidDiagnosticReplayFixture(fixture: DiagnosticReplayFixture): void {
  if (!fixture.fixtureId.trim()) throw new Error('Replay fixtureId must be non-empty');
  if (!fixture.provenance.trim()) throw new Error('Replay fixture provenance must be non-empty');
  if (!Number.isFinite(fixture.startedAt)) throw new Error('Replay fixture startedAt must be finite');
  if (fixture.protocol === 'UNKNOWN' || fixture.protocol === 'UDS') {
    throw new Error(`Replay fixture protocol ${fixture.protocol} is outside Check Core V1`);
  }

  const keys = new Set<string>();
  for (const script of fixture.scripts) {
    if (!script.semanticId.trim()) throw new Error('Replay script semanticId must be non-empty');
    if (script.events.length === 0) throw new Error(`Replay script ${script.semanticId} must contain at least one event`);

    const key = diagnosticReplayScriptKey(script.semanticId, script.targetEndpointId);
    if (keys.has(key)) throw new Error(`Duplicate replay script key: ${key}`);
    keys.add(key);

    for (const event of script.events) {
      if (!Number.isInteger(event.durationMs) || event.durationMs < 0) {
        throw new Error(`Replay event durationMs must be a non-negative integer for ${key}`);
      }
      const responses = diagnosticReplayEventResponses(event);
      if (responses.length === 0) {
        throw new Error(`Replay event must preserve at least one response for ${key}`);
      }
      for (const response of responses) {
        if (!Number.isInteger(response.observedResponseBytes) || response.observedResponseBytes < 0) {
          throw new Error(`Replay observedResponseBytes must be a non-negative integer for ${key}`);
        }
        if (response.envelope.protocol !== fixture.protocol) {
          throw new Error(`Replay envelope protocol mismatch for ${key}`);
        }
        if (!response.envelope.provenance.trim()) {
          throw new Error(`Replay envelope provenance must be non-empty for ${key}`);
        }
      }
    }
  }
}
