import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { CommandResult } from '../../../infrastructure/ble/real/pipeline/types';
import type { DiagnosticServiceEnvelope } from '../parsers/DiagnosticServiceEnvelope';
import type { PlannedDiagnosticExecutionReceipt, PlannedDiagnosticObservedResponse } from '../replay/DiagnosticExecutionPort';
import type { PlannedDiagnosticRequest } from '../planner/DiagnosticScanPlanner';

function normalizedHex(value: string): string | null {
  const hex = value.replace(/\s+/g, '').toUpperCase();
  return hex.length > 0 && hex.length % 2 === 0 && /^[0-9A-F]+$/.test(hex) ? hex : null;
}

function bytesFromHex(hex: string): readonly number[] {
  const values: number[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    values.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return Object.freeze(values);
}

function baseEnvelope(
  request: PlannedDiagnosticRequest,
  protocol: DiagnosticProtocol,
  provenance: string,
  observedAt: number,
  rawText?: string,
) {
  return {
    requestService: request.service,
    protocol,
    sourceEndpointId: null,
    provenance,
    observedAt,
    rawText,
  } as const;
}

function statusEnvelope(
  request: PlannedDiagnosticRequest,
  protocol: DiagnosticProtocol,
  result: CommandResult,
  provenance: string,
  observedAt: number,
): DiagnosticServiceEnvelope | null {
  const base = baseEnvelope(request, protocol, provenance, observedAt, result.rawResponse?.accumulatedText);
  switch (result.status) {
    case 'NO_DATA': return { ...base, kind: 'NO_DATA' };
    case 'TIMEOUT': return { ...base, kind: 'TIMEOUT' };
    case 'DISCONNECTED': return { ...base, kind: 'DISCONNECTED' };
    case 'ELM_ERROR': return { ...base, kind: 'FAILED', detail: result.errors.join('; ') || 'ELM adapter error' };
    case 'WRITE_FAILED': return { ...base, kind: 'FAILED', detail: result.errors.join('; ') || 'BLE write failed' };
    case 'CANCELLED': return { ...base, kind: 'FAILED', detail: 'Transport cancelled during command' };
    case 'PARTIAL': return { ...base, kind: 'PARTIAL', detail: 'Transport reported a partial response' };
    case 'INVALID_RESPONSE': return { ...base, kind: 'INVALID_RESPONSE', detail: result.errors.join('; ') || 'Transport pipeline rejected response' };
    case 'SUCCESS_DECODED':
    case 'SUCCESS_RAW':
      return null;
  }
}

function parseCandidate(
  request: PlannedDiagnosticRequest,
  protocol: DiagnosticProtocol,
  provenance: string,
  observedAt: number,
  rawLine: string,
): DiagnosticServiceEnvelope {
  const hex = normalizedHex(rawLine);
  const base = baseEnvelope(request, protocol, provenance, observedAt, rawLine);
  if (!hex) return { ...base, kind: 'INVALID_RESPONSE', detail: 'Candidate response is not an even-length hex frame' };

  const expectedPositive = request.expectedResponseService.toUpperCase();
  const requestedService = request.service.toUpperCase();

  // Check physical pilot config deliberately uses ATH0. Never guess through an
  // unexpected transport/header prefix here: source attribution remains null.
  if (hex.startsWith(expectedPositive)) {
    return {
      ...base,
      kind: 'POSITIVE_RESPONSE',
      responseService: expectedPositive,
      payload: bytesFromHex(hex.slice(2)),
    };
  }

  if (hex.startsWith('7F')) {
    if (hex.length < 6) return { ...base, kind: 'INVALID_RESPONSE', detail: 'Truncated negative response' };
    const echoedService = hex.slice(2, 4);
    if (echoedService !== requestedService) {
      return { ...base, kind: 'INVALID_RESPONSE', detail: `Negative response echoed ${echoedService}, expected ${requestedService}` };
    }
    return { ...base, kind: 'NEGATIVE_RESPONSE', negativeResponseCode: hex.slice(4, 6) };
  }

  return {
    ...base,
    kind: 'INVALID_RESPONSE',
    detail: `Response does not start with expected service ${expectedPositive}; header guessing is forbidden`,
  };
}

export function adaptRealCommandResultToReceipt(
  request: PlannedDiagnosticRequest,
  protocol: DiagnosticProtocol,
  result: CommandResult,
  logicalStartedAt: number,
  provenance: string,
): PlannedDiagnosticExecutionReceipt {
  const durationMs = Math.max(1, Number.isFinite(result.latencyMs) ? Math.round(result.latencyMs) : 1);
  const finishedAt = logicalStartedAt + durationMs;
  const terminalEnvelope = statusEnvelope(request, protocol, result, provenance, finishedAt);

  if (terminalEnvelope) {
    const bytes = result.normalizedResponse?.candidateHexLines
      .map(normalizedHex)
      .filter((value): value is string => Boolean(value))
      .reduce((sum, hex) => sum + hex.length / 2, 0) ?? 0;
    return Object.freeze({
      startedAt: logicalStartedAt,
      finishedAt,
      responses: Object.freeze([{ envelope: terminalEnvelope, observedResponseBytes: bytes }]),
    });
  }

  const candidates = result.normalizedResponse?.candidateHexLines ?? [];
  if (candidates.length === 0) {
    const invalid: DiagnosticServiceEnvelope = {
      ...baseEnvelope(request, protocol, provenance, finishedAt, result.rawResponse?.accumulatedText),
      kind: 'INVALID_RESPONSE',
      detail: 'Successful transport result contained no diagnostic candidate frame',
    };
    return Object.freeze({
      startedAt: logicalStartedAt,
      finishedAt,
      responses: Object.freeze([{ envelope: invalid, observedResponseBytes: 0 }]),
    });
  }

  const responses: PlannedDiagnosticObservedResponse[] = candidates.map(rawLine => {
    const hex = normalizedHex(rawLine);
    return Object.freeze({
      envelope: parseCandidate(request, protocol, provenance, finishedAt, rawLine),
      observedResponseBytes: hex ? hex.length / 2 : 0,
    });
  });

  return Object.freeze({
    startedAt: logicalStartedAt,
    finishedAt,
    responses: Object.freeze(responses),
  });
}
