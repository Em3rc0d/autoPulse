import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import { authorizeRegisteredDescriptor, CHECK_COMMAND_SAFETY_POLICY_VERSION, DiagnosticSafetyBlockReason } from './DiagnosticCommandSafetyPolicy';
import { assertValidCommandBudget, CommandBudget, CommandBudgetUsage, evaluateBudgetBeforeCommand } from './CommandBudget';
import type { DiagnosticDescriptorRegistry } from './DiagnosticDescriptorRegistry';
import type { DiagnosticPlannerStage, DiagnosticRequestDescriptor } from './DiagnosticRequestDescriptor';
import { assertValidRetryPolicy, RetryPolicy } from './RetryPolicy';
import { assertValidStageDeadlinePolicy, evaluateStageGate, StageDeadlinePolicy, StageGateBlockReason } from './StageDeadlinePolicy';

export interface DiagnosticPlanProposal {
  readonly semanticId: string;
  readonly required: boolean;
  readonly targetEndpointId?: string | null;
  readonly rationaleEvidenceIds?: readonly string[];
}

export interface PlannedDiagnosticRequest {
  readonly planRequestId: string;
  readonly planId: string;
  readonly ordinal: number;
  readonly descriptorId: string;
  readonly semanticId: string;
  readonly registryVersion: string;
  readonly safetyPolicyVersion: typeof CHECK_COMMAND_SAFETY_POLICY_VERSION;
  readonly parserContractId: string;
  readonly descriptorProvenance: string;
  readonly stage: DiagnosticPlannerStage;
  readonly service: string;
  readonly pid?: string;
  readonly subfunction?: string;
  readonly expectedResponseService: string;
  readonly supportedProtocols: readonly DiagnosticProtocol[];
  readonly targetEndpointId: string | null;
  readonly evidenceTraceId: string;
  readonly rationaleEvidenceIds: readonly string[];
  readonly executionMode: 'SERIAL_ONLY';
}

export interface DiagnosticPlanBlockedProposal {
  readonly semanticId: string;
  readonly required: boolean;
  readonly targetEndpointId: string | null;
  readonly reason: DiagnosticSafetyBlockReason | 'PLAN_COMMAND_BUDGET_EXCEEDED';
}

export interface DiagnosticScanPlan {
  readonly planId: string;
  readonly createdAt: number;
  readonly protocol: DiagnosticProtocol;
  readonly registryVersion: string;
  readonly safetyPolicyVersion: typeof CHECK_COMMAND_SAFETY_POLICY_VERSION;
  readonly status: 'READY' | 'LIMITED' | 'BLOCKED';
  readonly serialExecution: true;
  readonly budget: CommandBudget;
  readonly retryPolicy: RetryPolicy;
  readonly deadlinePolicy: StageDeadlinePolicy;
  readonly requests: readonly PlannedDiagnosticRequest[];
  readonly blockedProposals: readonly DiagnosticPlanBlockedProposal[];
}

export interface DiagnosticEvidenceTrace {
  readonly evidenceTraceId: string;
  readonly planId: string;
  readonly planRequestId: string;
  readonly descriptorId: string;
  readonly semanticId: string;
  readonly parserContractId: string;
  readonly targetEndpointId: string | null;
}

export interface BuildDiagnosticScanPlanInput {
  readonly planId: string;
  readonly createdAt: number;
  readonly protocol: DiagnosticProtocol;
  readonly registry: DiagnosticDescriptorRegistry;
  readonly proposals: readonly DiagnosticPlanProposal[];
  readonly budget: CommandBudget;
  readonly retryPolicy: RetryPolicy;
  readonly deadlinePolicy: StageDeadlinePolicy;
}

const STAGE_ORDER: Readonly<Record<DiagnosticPlannerStage, number>> = {
  CAPABILITY_DISCOVERY: 0,
  DTC_CORE: 1,
};

function targetKey(proposal: DiagnosticPlanProposal): string {
  return proposal.targetEndpointId ?? 'FUNCTIONAL_OR_UNATTRIBUTED';
}

function plannedFromDescriptor(
  input: BuildDiagnosticScanPlanInput,
  descriptor: DiagnosticRequestDescriptor,
  proposal: DiagnosticPlanProposal,
  ordinal: number,
): PlannedDiagnosticRequest {
  const endpoint = proposal.targetEndpointId ?? null;
  const planRequestId = `${input.planId}:request:${ordinal}:${descriptor.descriptorId}:${targetKey(proposal)}`;
  return Object.freeze({
    planRequestId,
    planId: input.planId,
    ordinal,
    descriptorId: descriptor.descriptorId,
    semanticId: descriptor.semanticId,
    registryVersion: input.registry.version,
    safetyPolicyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
    parserContractId: descriptor.parserContractId,
    descriptorProvenance: descriptor.provenance,
    stage: descriptor.stage,
    service: descriptor.service,
    pid: descriptor.pid,
    subfunction: descriptor.subfunction,
    expectedResponseService: descriptor.expectedResponseService,
    supportedProtocols: Object.freeze([...descriptor.supportedProtocols]),
    targetEndpointId: endpoint,
    evidenceTraceId: `${input.planId}:evidence:${ordinal}:${descriptor.descriptorId}:${targetKey(proposal)}`,
    rationaleEvidenceIds: Object.freeze([...(proposal.rationaleEvidenceIds ?? [])]),
    executionMode: 'SERIAL_ONLY' as const,
  });
}

export function evidenceTraceForPlannedRequest(request: PlannedDiagnosticRequest): DiagnosticEvidenceTrace {
  return Object.freeze({
    evidenceTraceId: request.evidenceTraceId,
    planId: request.planId,
    planRequestId: request.planRequestId,
    descriptorId: request.descriptorId,
    semanticId: request.semanticId,
    parserContractId: request.parserContractId,
    targetEndpointId: request.targetEndpointId,
  });
}

function frozenPlan(
  input: BuildDiagnosticScanPlanInput,
  status: DiagnosticScanPlan['status'],
  requests: readonly PlannedDiagnosticRequest[],
  blocked: readonly DiagnosticPlanBlockedProposal[],
): DiagnosticScanPlan {
  return Object.freeze({
    planId: input.planId,
    createdAt: input.createdAt,
    protocol: input.protocol,
    registryVersion: input.registry.version,
    safetyPolicyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
    status,
    serialExecution: true as const,
    budget: Object.freeze({ ...input.budget }),
    retryPolicy: Object.freeze({
      ...input.retryPolicy,
      retryableOutcomes: Object.freeze([...input.retryPolicy.retryableOutcomes]),
      responsePending: Object.freeze({ ...input.retryPolicy.responsePending }),
    }),
    deadlinePolicy: Object.freeze({
      ...input.deadlinePolicy,
      stageDeadlineMs: Object.freeze({ ...input.deadlinePolicy.stageDeadlineMs }),
    }),
    requests: Object.freeze([...requests]),
    blockedProposals: Object.freeze([...blocked]),
  });
}

export function buildDiagnosticScanPlan(input: BuildDiagnosticScanPlanInput): DiagnosticScanPlan {
  if (!input.planId.trim()) throw new Error('Diagnostic plan id must be non-empty');
  if (!Number.isFinite(input.createdAt)) throw new Error('Diagnostic plan createdAt must be finite');
  assertValidCommandBudget(input.budget);
  assertValidRetryPolicy(input.retryPolicy);
  assertValidStageDeadlinePolicy(input.deadlinePolicy);

  const blocked: DiagnosticPlanBlockedProposal[] = [];
  const authorized: Array<{ proposal: DiagnosticPlanProposal; descriptor: DiagnosticRequestDescriptor; inputIndex: number }> = [];
  const seen = new Set<string>();

  input.proposals.forEach((proposal, inputIndex) => {
    const dedupeKey = `${proposal.semanticId}:${targetKey(proposal)}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const decision = authorizeRegisteredDescriptor(input.registry, proposal.semanticId, input.protocol);
    if (decision.disposition === 'BLOCK') {
      blocked.push(Object.freeze({
        semanticId: proposal.semanticId,
        required: proposal.required,
        targetEndpointId: proposal.targetEndpointId ?? null,
        reason: decision.reason,
      }));
      return;
    }
    authorized.push({ proposal, descriptor: decision.descriptor, inputIndex });
  });

  if (blocked.some(item => item.required)) {
    return frozenPlan(input, 'BLOCKED', [], blocked);
  }

  authorized.sort((a, b) => {
    const stage = STAGE_ORDER[a.descriptor.stage] - STAGE_ORDER[b.descriptor.stage];
    if (stage !== 0) return stage;
    if (a.proposal.required !== b.proposal.required) return a.proposal.required ? -1 : 1;
    return a.inputIndex - b.inputIndex;
  });

  const requiredCount = authorized.filter(item => item.proposal.required).length;
  if (requiredCount > input.budget.maxCommands) {
    blocked.push(...authorized.filter(item => item.proposal.required).map(item => Object.freeze({
      semanticId: item.proposal.semanticId,
      required: true,
      targetEndpointId: item.proposal.targetEndpointId ?? null,
      reason: 'PLAN_COMMAND_BUDGET_EXCEEDED' as const,
    })));
    return frozenPlan(input, 'BLOCKED', [], blocked);
  }

  const selected: Array<{ proposal: DiagnosticPlanProposal; descriptor: DiagnosticRequestDescriptor }> = [];
  for (const item of authorized) {
    if (selected.length < input.budget.maxCommands) {
      selected.push(item);
    } else {
      blocked.push(Object.freeze({
        semanticId: item.proposal.semanticId,
        required: item.proposal.required,
        targetEndpointId: item.proposal.targetEndpointId ?? null,
        reason: 'PLAN_COMMAND_BUDGET_EXCEEDED' as const,
      }));
    }
  }

  const requests = selected.map((item, index) => plannedFromDescriptor(input, item.descriptor, item.proposal, index));
  return frozenPlan(input, blocked.length > 0 ? 'LIMITED' : 'READY', requests, blocked);
}

export type PlannedRequestGateBlockReason =
  | 'PLAN_BLOCKED'
  | 'REQUEST_NOT_IN_PLAN'
  | StageGateBlockReason
  | 'COMMAND_BUDGET_EXHAUSTED'
  | 'TOTAL_BYTE_BUDGET_EXHAUSTED'
  | 'ELAPSED_TIME_BUDGET_EXHAUSTED';

export type PlannedRequestGateDecision =
  | { readonly disposition: 'ALLOW'; readonly deadlineRemainingMs: number }
  | { readonly disposition: 'BLOCK'; readonly reason: PlannedRequestGateBlockReason };

export interface PlannedRequestGateContext {
  readonly planRequestId: string;
  readonly scanStartedAt: number;
  readonly stageStartedAt: number;
  readonly now: number;
  readonly cancelRequested: boolean;
  readonly budgetUsage: Pick<CommandBudgetUsage, 'commandsIssued' | 'responseBytes'>;
}

/** Pure pre-execution gate for MK6. It never calls a connector. */
export function evaluatePlannedRequestGate(
  plan: DiagnosticScanPlan,
  context: PlannedRequestGateContext,
): PlannedRequestGateDecision {
  if (plan.status === 'BLOCKED') return { disposition: 'BLOCK', reason: 'PLAN_BLOCKED' };
  const request = plan.requests.find(item => item.planRequestId === context.planRequestId);
  if (!request) return { disposition: 'BLOCK', reason: 'REQUEST_NOT_IN_PLAN' };

  const stageGate = evaluateStageGate(plan.deadlinePolicy, {
    stage: request.stage,
    scanStartedAt: context.scanStartedAt,
    stageStartedAt: context.stageStartedAt,
    now: context.now,
    cancelRequested: context.cancelRequested,
  });
  if (stageGate.disposition === 'BLOCK') return { disposition: 'BLOCK', reason: stageGate.reason };

  const budgetDecision = evaluateBudgetBeforeCommand(plan.budget, {
    commandsIssued: context.budgetUsage.commandsIssued,
    responseBytes: context.budgetUsage.responseBytes,
    elapsedMs: context.now - context.scanStartedAt,
  });
  if (budgetDecision.disposition === 'BLOCK') {
    if (budgetDecision.reason === 'RESPONSE_BYTE_CEILING_EXCEEDED') {
      throw new Error('Response-byte ceiling is evaluated only after a response is observed');
    }
    return { disposition: 'BLOCK', reason: budgetDecision.reason };
  }
  return { disposition: 'ALLOW', deadlineRemainingMs: stageGate.remainingMs };
}
