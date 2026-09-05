import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticServiceEnvelope } from '../parsers/DiagnosticServiceEnvelope';

export type DiagnosticReplayEventKind = 'COMMAND_RESPONSE' | 'PENDING_CONTINUATION';

export interface DiagnosticReplayEvent {
  readonly kind: DiagnosticReplayEventKind;
  /** Deterministic elapsed time between event start and observed envelope. */
  readonly durationMs: number;
  readonly observedResponseBytes: number;
  readonly envelope: DiagnosticServiceEnvelope;
}

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
      if (!Number.isInteger(event.observedResponseBytes) || event.observedResponseBytes < 0) {
        throw new Error(`Replay observedResponseBytes must be a non-negative integer for ${key}`);
      }
      if (event.envelope.protocol !== fixture.protocol) {
        throw new Error(`Replay envelope protocol mismatch for ${key}`);
      }
      if (!event.envelope.provenance.trim()) {
        throw new Error(`Replay envelope provenance must be non-empty for ${key}`);
      }
    }
  }
}
