import type { DiagnosticPlannerStage } from './DiagnosticRequestDescriptor';

export interface StageDeadlinePolicy {
  readonly overallDeadlineMs: number;
  readonly stageDeadlineMs: Readonly<{
    CAPABILITY_DISCOVERY: number;
    DTC_CORE: number;
    /** Required only for plans that contain targeted PID acquisition. */
    TARGETED_PID_ACQUISITION?: number;
  }>;
  readonly provenance: string;
}

export type StageGateBlockReason =
  | 'CANCELLED'
  | 'OVERALL_DEADLINE_EXCEEDED'
  | 'STAGE_DEADLINE_EXCEEDED';

export type StageGateDecision =
  | { readonly disposition: 'ALLOW'; readonly remainingMs: number }
  | { readonly disposition: 'BLOCK'; readonly reason: StageGateBlockReason; readonly remainingMs: 0 };

export interface StageGateContext {
  readonly stage: DiagnosticPlannerStage;
  readonly scanStartedAt: number;
  readonly stageStartedAt: number;
  readonly now: number;
  readonly cancelRequested: boolean;
}

export function assertValidStageDeadlinePolicy(policy: StageDeadlinePolicy): void {
  if (!Number.isInteger(policy.overallDeadlineMs) || policy.overallDeadlineMs < 1) {
    throw new Error('StageDeadlinePolicy.overallDeadlineMs must be a positive integer');
  }
  for (const stage of ['CAPABILITY_DISCOVERY', 'DTC_CORE'] as const) {
    const value = policy.stageDeadlineMs[stage];
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`StageDeadlinePolicy deadline for ${stage} must be a positive integer`);
    }
    if (value > policy.overallDeadlineMs) {
      throw new Error(`StageDeadlinePolicy deadline for ${stage} cannot exceed overall deadline`);
    }
  }
  const targeted = policy.stageDeadlineMs.TARGETED_PID_ACQUISITION;
  if (targeted !== undefined) {
    if (!Number.isInteger(targeted) || targeted < 1) {
      throw new Error('StageDeadlinePolicy deadline for TARGETED_PID_ACQUISITION must be a positive integer');
    }
    if (targeted > policy.overallDeadlineMs) {
      throw new Error('StageDeadlinePolicy deadline for TARGETED_PID_ACQUISITION cannot exceed overall deadline');
    }
  }
  if (!policy.provenance.trim()) throw new Error('StageDeadlinePolicy.provenance must be non-empty');
}

export function evaluateStageGate(
  policy: StageDeadlinePolicy,
  context: StageGateContext,
): StageGateDecision {
  assertValidStageDeadlinePolicy(policy);
  if (![context.scanStartedAt, context.stageStartedAt, context.now].every(Number.isFinite)) {
    throw new Error('Stage gate timestamps must be finite numbers');
  }
  if (context.stageStartedAt < context.scanStartedAt || context.now < context.stageStartedAt) {
    throw new Error('Stage gate timestamps are not monotonic');
  }
  if (context.cancelRequested) {
    return { disposition: 'BLOCK', reason: 'CANCELLED', remainingMs: 0 };
  }

  const stageDeadlineMs = policy.stageDeadlineMs[context.stage];
  if (!Number.isInteger(stageDeadlineMs) || (stageDeadlineMs ?? 0) < 1) {
    throw new Error(`StageDeadlinePolicy deadline for ${context.stage} is required by this plan`);
  }

  const overallDeadlineAt = context.scanStartedAt + policy.overallDeadlineMs;
  const stageDeadlineAt = context.stageStartedAt + (stageDeadlineMs as number);
  if (context.now >= overallDeadlineAt) {
    return { disposition: 'BLOCK', reason: 'OVERALL_DEADLINE_EXCEEDED', remainingMs: 0 };
  }
  if (context.now >= stageDeadlineAt) {
    return { disposition: 'BLOCK', reason: 'STAGE_DEADLINE_EXCEEDED', remainingMs: 0 };
  }

  return {
    disposition: 'ALLOW',
    remainingMs: Math.min(overallDeadlineAt, stageDeadlineAt) - context.now,
  };
}
