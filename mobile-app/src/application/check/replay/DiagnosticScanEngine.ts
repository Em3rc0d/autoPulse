import type { DiagnosticScanTerminalState } from '../../../domain/check/DiagnosticScanState';
import type { Mode01CapabilityCommand } from '../../../domain/acquisition/Mode01CapabilityDiscovery';
import type { DiagnosticServiceEnvelope } from '../parsers/DiagnosticServiceEnvelope';
import { DtcRequestService, DtcServiceParseResult, parseDtcServiceEnvelope } from '../parsers/DtcServiceParser';
import { parsePidSupportBitmap, PidSupportBitmapParseResult } from '../parsers/PidSupportBitmapParser';
import {
  CommandBudgetDecision,
  CommandBudgetUsage,
  evaluateObservedResponseBytes,
  recordCommandIssued,
  recordObservedResponseBytes,
} from '../planner/CommandBudget';
import { DiagnosticAttemptOutcome, decideRetry } from '../planner/RetryPolicy';
import {
  DiagnosticScanPlan,
  evaluatePlannedRequestGate,
  PlannedDiagnosticRequest,
} from '../planner/DiagnosticScanPlanner';
import type { PlannedDiagnosticExecutionReceipt, PlannedDiagnosticExecutor } from './DiagnosticExecutionPort';

export const CHECK_SCAN_ENGINE_VERSION = 'check-scan-engine/v2' as const;

export interface DiagnosticScanAttemptRecord {
  readonly planRequestId: string;
  readonly semanticId: string;
  readonly descriptorId: string;
  readonly evidenceTraceId: string;
  readonly targetEndpointId: string | null;
  /** Actual responder identity; null means unattributed rather than guessed. */
  readonly sourceEndpointId: string | null;
  readonly responderIndex: number;
  readonly eventKind: 'COMMAND_RESPONSE' | 'PENDING_CONTINUATION';
  readonly commandAttemptIndex: number;
  readonly pendingExtensionIndex: number;
  readonly responseKind: DiagnosticServiceEnvelope['kind'];
  readonly outcome: DiagnosticAttemptOutcome;
  readonly observedResponseBytes: number;
  readonly startedAt: number;
  readonly finishedAt: number;
}

export interface DiagnosticScanEngineResult {
  readonly engineVersion: typeof CHECK_SCAN_ENGINE_VERSION;
  readonly planId: string;
  readonly protocol: DiagnosticScanPlan['protocol'];
  readonly state: DiagnosticScanTerminalState;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly attempts: readonly DiagnosticScanAttemptRecord[];
  readonly dtcResults: readonly DtcServiceParseResult[];
  readonly pidSupportResults: readonly PidSupportBitmapParseResult[];
  readonly usage: CommandBudgetUsage;
  readonly limitations: readonly string[];
}

export interface RunDiagnosticScanInput {
  readonly plan: DiagnosticScanPlan;
  readonly executor: PlannedDiagnosticExecutor;
  /** Deterministic cancellation point for replay/tests. Omit for no cancellation. */
  readonly cancelRequestedAt?: number;
}

interface ParsedAttempt {
  readonly outcome: DiagnosticAttemptOutcome;
  readonly dtcResult?: DtcServiceParseResult;
  readonly pidSupportResult?: PidSupportBitmapParseResult;
}

function envelopeOutcome(envelope: DiagnosticServiceEnvelope): DiagnosticAttemptOutcome {
  switch (envelope.kind) {
    case 'POSITIVE_RESPONSE': return 'SUCCESS';
    case 'NEGATIVE_RESPONSE': return envelope.negativeResponseCode.toUpperCase() === '78' ? 'RESPONSE_PENDING' : 'NEGATIVE_RESPONSE';
    case 'NO_DATA': return 'NO_DATA';
    case 'TIMEOUT': return 'TIMEOUT';
    case 'DISCONNECTED': return 'DISCONNECTED';
    case 'UNSUPPORTED': return 'UNSUPPORTED';
    case 'FAILED': return 'FAILED';
    case 'PARTIAL': return 'PARTIAL';
    case 'INVALID_RESPONSE': return 'INVALID_RESPONSE';
  }
}

function parseAttempt(request: PlannedDiagnosticRequest, envelope: DiagnosticServiceEnvelope): ParsedAttempt {
  if (request.parserContractId === 'check.dtc-service/v1') {
    const result = parseDtcServiceEnvelope(request.service as DtcRequestService, envelope);
    const outcome: DiagnosticAttemptOutcome = result.outcome === 'SUCCESS_WITH_CODES' || result.outcome === 'SUCCESS_ZERO_CODES'
      ? 'SUCCESS'
      : result.outcome;
    return { outcome, dtcResult: result };
  }

  if (request.parserContractId === 'check.mode01.support-bitmap/v1') {
    if (envelope.kind !== 'POSITIVE_RESPONSE') return { outcome: envelopeOutcome(envelope) };
    if (envelope.requestService.toUpperCase() !== request.service.toUpperCase()) return { outcome: 'INVALID_RESPONSE' };
    if (envelope.responseService.toUpperCase() !== request.expectedResponseService.toUpperCase()) return { outcome: 'INVALID_RESPONSE' };
    if (!request.pid || envelope.payload.length < 1) return { outcome: 'INVALID_RESPONSE' };

    const observedPid = envelope.payload[0];
    const expectedPid = Number.parseInt(request.pid, 16);
    if (!Number.isInteger(expectedPid) || observedPid !== expectedPid) return { outcome: 'INVALID_RESPONSE' };

    const command = `${request.service}${request.pid}`.toUpperCase() as Mode01CapabilityCommand;
    const result = parsePidSupportBitmap(command, envelope.payload.slice(1));
    return { outcome: result.outcome === 'VALID' ? 'SUCCESS' : 'INVALID_RESPONSE', pidSupportResult: result };
  }

  return { outcome: 'INVALID_RESPONSE' };
}

/**
 * A functional OBD request may yield several ECU responses. Retry decisions
 * are made for the command transaction, not by silently choosing one ECU.
 */
function aggregateResponderOutcomes(parsed: readonly ParsedAttempt[]): DiagnosticAttemptOutcome {
  if (parsed.length === 0) return 'INVALID_RESPONSE';
  const values = parsed.map(item => item.outcome);
  if (values.every(value => value === values[0])) return values[0];
  if (values.includes('DISCONNECTED')) return 'DISCONNECTED';
  // Mixed pending/success or success/failure is real partial coverage and must
  // not become SUCCESS or trigger a hidden retry that duplicates good evidence.
  return 'PARTIAL';
}

function acceptReceiptBytes(
  plan: DiagnosticScanPlan,
  usage: CommandBudgetUsage,
  receipt: PlannedDiagnosticExecutionReceipt,
): { readonly decision: CommandBudgetDecision; readonly usage: CommandBudgetUsage } {
  let next = usage;
  for (const response of receipt.responses) {
    const decision = evaluateObservedResponseBytes(plan.budget, next, response.observedResponseBytes);
    if (decision.disposition === 'BLOCK') return { decision, usage };
    next = recordObservedResponseBytes(next, response.observedResponseBytes);
  }
  return { decision: { disposition: 'ALLOW' }, usage: next };
}

function frozenResult(
  plan: DiagnosticScanPlan,
  state: DiagnosticScanTerminalState,
  startedAt: number,
  endedAt: number,
  attempts: readonly DiagnosticScanAttemptRecord[],
  dtcResults: readonly DtcServiceParseResult[],
  pidSupportResults: readonly PidSupportBitmapParseResult[],
  usage: CommandBudgetUsage,
  limitations: readonly string[],
): DiagnosticScanEngineResult {
  return Object.freeze({
    engineVersion: CHECK_SCAN_ENGINE_VERSION,
    planId: plan.planId,
    protocol: plan.protocol,
    state,
    startedAt,
    endedAt,
    attempts: Object.freeze([...attempts]),
    dtcResults: Object.freeze([...dtcResults]),
    pidSupportResults: Object.freeze([...pidSupportResults]),
    usage: Object.freeze({ ...usage, elapsedMs: endedAt - startedAt }),
    limitations: Object.freeze([...limitations]),
  });
}

function cancellationRequested(cancelRequestedAt: number | undefined, now: number): boolean {
  return cancelRequestedAt !== undefined && now >= cancelRequestedAt;
}

/**
 * Structural scan engine. It consumes only an MK5 plan and a descriptor-only
 * executor port. This module contains no BLE/ELM/DB imports.
 */
export async function runDiagnosticScan(input: RunDiagnosticScanInput): Promise<DiagnosticScanEngineResult> {
  const { plan, executor } = input;
  const startedAt = plan.createdAt;
  let now = startedAt;
  let stageStartedAt = startedAt;
  let currentStage = plan.requests[0]?.stage;
  let lastTransactionFinishedAt: number | undefined;
  let usage: CommandBudgetUsage = { commandsIssued: 0, responseBytes: 0, elapsedMs: 0 };
  const attempts: DiagnosticScanAttemptRecord[] = [];
  const dtcResults: DtcServiceParseResult[] = [];
  const pidSupportResults: PidSupportBitmapParseResult[] = [];
  const limitations: string[] = [];
  let limited = plan.status === 'LIMITED';

  if (plan.status === 'BLOCKED') {
    limitations.push(...plan.blockedProposals.map(item => `${item.semanticId}:${item.reason}`));
    return frozenResult(plan, 'FAILED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
  }

  for (const request of plan.requests) {
    if (currentStage !== request.stage) {
      currentStage = request.stage;
      stageStartedAt = now;
    }

    let retriesUsed = 0;
    let pendingExtensionsUsed = 0;
    let commandAttemptIndex = 0;
    let pendingContinuation = false;
    let requestComplete = false;

    while (!requestComplete) {
      if (!pendingContinuation && lastTransactionFinishedAt !== undefined) {
        now = Math.max(now, lastTransactionFinishedAt + plan.budget.minInterCommandDelayMs);
      }

      if (cancellationRequested(input.cancelRequestedAt, now)) {
        limitations.push(`cancelled-before:${request.semanticId}`);
        return frozenResult(plan, 'CANCELLED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
      }

      let receipt: PlannedDiagnosticExecutionReceipt;
      let gateRemainingMs: number;
      try {
        if (pendingContinuation) {
          const overallRemaining = Math.max(0, plan.deadlinePolicy.overallDeadlineMs - (now - startedAt));
          const stageLimit = plan.deadlinePolicy.stageDeadlineMs[request.stage];
          const stageRemaining = Math.max(0, stageLimit - (now - stageStartedAt));
          gateRemainingMs = Math.min(overallRemaining, stageRemaining);
          if (gateRemainingMs <= 0) {
            limitations.push(`deadline-before-pending-continuation:${request.semanticId}`);
            limited = true;
            break;
          }
          receipt = await executor.awaitPendingContinuation(
            request,
            pendingExtensionsUsed,
            now,
            Math.min(plan.retryPolicy.responsePending.extensionMs, gateRemainingMs),
          );
        } else {
          const gate = evaluatePlannedRequestGate(plan, {
            planRequestId: request.planRequestId,
            nextRequestOrdinal: request.ordinal,
            scanStartedAt: startedAt,
            stageStartedAt,
            now,
            cancelRequested: false,
            lastCommandFinishedAt: lastTransactionFinishedAt,
            budgetUsage: usage,
          });
          if (gate.disposition === 'BLOCK') {
            limitations.push(`gate:${request.semanticId}:${gate.reason}`);
            if (gate.reason === 'CANCELLED') {
              return frozenResult(plan, 'CANCELLED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
            }
            return frozenResult(plan, request.required ? 'FAILED' : 'LIMITED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
          }
          gateRemainingMs = gate.deadlineRemainingMs;
          usage = recordCommandIssued({ ...usage, elapsedMs: now - startedAt });
          receipt = await executor.executeCommand(request, commandAttemptIndex, now);
          commandAttemptIndex += 1;
        }
      } catch (error) {
        limitations.push(`executor:${request.semanticId}:${error instanceof Error ? error.message : String(error)}`);
        return frozenResult(plan, 'FAILED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
      }

      now = receipt.finishedAt;
      lastTransactionFinishedAt = receipt.finishedAt;
      if (receipt.responses.length === 0) {
        limitations.push(`executor:${request.semanticId}:EMPTY_RESPONSE_SET`);
        return frozenResult(plan, 'FAILED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
      }

      const accepted = acceptReceiptBytes(
        plan,
        { ...usage, elapsedMs: receipt.finishedAt - startedAt },
        receipt,
      );
      if (accepted.decision.disposition === 'BLOCK') {
        limitations.push(`response-budget:${request.semanticId}:${accepted.decision.reason}`);
        if (request.required) {
          return frozenResult(plan, 'FAILED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
        }
        limited = true;
        break;
      }
      usage = Object.freeze({ ...accepted.usage, elapsedMs: now - startedAt });

      const parsedResponses = receipt.responses.map(response => parseAttempt(request, response.envelope));
      parsedResponses.forEach(parsed => {
        if (parsed.dtcResult) dtcResults.push(parsed.dtcResult);
        if (parsed.pidSupportResult) pidSupportResults.push(parsed.pidSupportResult);
      });

      receipt.responses.forEach((response, responderIndex) => {
        const parsed = parsedResponses[responderIndex];
        attempts.push(Object.freeze({
          planRequestId: request.planRequestId,
          semanticId: request.semanticId,
          descriptorId: request.descriptorId,
          evidenceTraceId: request.evidenceTraceId,
          targetEndpointId: request.targetEndpointId,
          sourceEndpointId: response.envelope.sourceEndpointId,
          responderIndex,
          eventKind: pendingContinuation ? 'PENDING_CONTINUATION' : 'COMMAND_RESPONSE',
          commandAttemptIndex: Math.max(0, commandAttemptIndex - 1),
          pendingExtensionIndex: pendingExtensionsUsed,
          responseKind: response.envelope.kind,
          outcome: parsed.outcome,
          observedResponseBytes: response.observedResponseBytes,
          startedAt: receipt.startedAt,
          finishedAt: receipt.finishedAt,
        }));
      });

      const transactionOutcome = aggregateResponderOutcomes(parsedResponses);
      if (transactionOutcome === 'DISCONNECTED') {
        limitations.push(`disconnected:${request.semanticId}`);
        return frozenResult(plan, 'DISCONNECTED', startedAt, now, attempts, dtcResults, pidSupportResults, usage, limitations);
      }
      if (transactionOutcome === 'PARTIAL' && receipt.responses.length > 1) {
        limitations.push(`mixed-responder-outcomes:${request.semanticId}`);
      }

      const decision = decideRetry(plan.retryPolicy, {
        outcome: transactionOutcome,
        retriesUsed,
        pendingExtensionsUsed,
        remainingMs: Math.max(0, gateRemainingMs - (receipt.finishedAt - receipt.startedAt)),
      });

      if (decision.action === 'COMPLETE') {
        requestComplete = true;
        pendingContinuation = false;
        continue;
      }
      if (decision.action === 'RETRY') {
        retriesUsed = decision.nextRetryIndex;
        pendingContinuation = false;
        continue;
      }
      if (decision.action === 'WAIT_PENDING') {
        pendingExtensionsUsed = decision.nextPendingExtensionIndex;
        pendingContinuation = true;
        continue;
      }

      limitations.push(`${request.semanticId}:${transactionOutcome}:${decision.reason}`);
      limited = true;
      requestComplete = true;
    }
  }

  return frozenResult(
    plan,
    limited ? 'LIMITED' : 'COMPLETE',
    startedAt,
    now,
    attempts,
    dtcResults,
    pidSupportResults,
    usage,
    limitations,
  );
}
