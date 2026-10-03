export type DiagnosticAttemptOutcome =
  | 'SUCCESS'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'DEADLINE_EXCEEDED'
  | 'INVALID_RESPONSE'
  | 'NEGATIVE_RESPONSE'
  | 'RESPONSE_PENDING'
  | 'DISCONNECTED'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'PARTIAL';

export type ExplicitlyRetryableOutcome = 'TIMEOUT' | 'NO_DATA' | 'FAILED';

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly retryableOutcomes: readonly ExplicitlyRetryableOutcome[];
  readonly responsePending: {
    readonly maxExtensions: number;
    readonly extensionMs: number;
  };
  readonly provenance: string;
}

export interface RetryDecisionContext {
  readonly outcome: DiagnosticAttemptOutcome;
  readonly retriesUsed: number;
  readonly pendingExtensionsUsed: number;
  /** Remaining time from the deterministic stage/overall deadline gate. */
  readonly remainingMs: number;
}

export type RetryDecision =
  | { readonly action: 'COMPLETE'; readonly reason: 'SUCCESS' }
  | { readonly action: 'RETRY'; readonly nextRetryIndex: number }
  | { readonly action: 'WAIT_PENDING'; readonly extensionMs: number; readonly nextPendingExtensionIndex: number }
  | {
      readonly action: 'STOP';
      readonly reason:
        | 'OUTCOME_NOT_RETRYABLE'
        | 'RETRY_BUDGET_EXHAUSTED'
        | 'PENDING_EXTENSION_BUDGET_EXHAUSTED'
        | 'PENDING_WOULD_CROSS_DEADLINE';
    };

export function assertValidRetryPolicy(policy: RetryPolicy): void {
  if (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 0) {
    throw new Error('RetryPolicy.maxRetries must be a non-negative integer');
  }
  if (!Number.isInteger(policy.responsePending.maxExtensions) || policy.responsePending.maxExtensions < 0) {
    throw new Error('RetryPolicy.responsePending.maxExtensions must be a non-negative integer');
  }
  if (!Number.isInteger(policy.responsePending.extensionMs) || policy.responsePending.extensionMs < 1) {
    throw new Error('RetryPolicy.responsePending.extensionMs must be a positive integer');
  }
  if (!policy.provenance.trim()) throw new Error('RetryPolicy.provenance must be non-empty');
  const unique = new Set(policy.retryableOutcomes);
  if (unique.size !== policy.retryableOutcomes.length) {
    throw new Error('RetryPolicy.retryableOutcomes contains duplicates');
  }
}

export function decideRetry(
  policy: RetryPolicy,
  context: RetryDecisionContext,
): RetryDecision {
  assertValidRetryPolicy(policy);
  if (!Number.isInteger(context.retriesUsed) || context.retriesUsed < 0) {
    throw new Error('retriesUsed must be a non-negative integer');
  }
  if (!Number.isInteger(context.pendingExtensionsUsed) || context.pendingExtensionsUsed < 0) {
    throw new Error('pendingExtensionsUsed must be a non-negative integer');
  }
  if (!Number.isFinite(context.remainingMs) || context.remainingMs < 0) {
    throw new Error('remainingMs must be a finite non-negative number');
  }

  if (context.outcome === 'SUCCESS') {
    return { action: 'COMPLETE', reason: 'SUCCESS' };
  }

  if (context.outcome === 'RESPONSE_PENDING') {
    if (context.pendingExtensionsUsed >= policy.responsePending.maxExtensions) {
      return { action: 'STOP', reason: 'PENDING_EXTENSION_BUDGET_EXHAUSTED' };
    }
    if (policy.responsePending.extensionMs >= context.remainingMs) {
      return { action: 'STOP', reason: 'PENDING_WOULD_CROSS_DEADLINE' };
    }
    return {
      action: 'WAIT_PENDING',
      extensionMs: policy.responsePending.extensionMs,
      nextPendingExtensionIndex: context.pendingExtensionsUsed + 1,
    };
  }

  if (!(policy.retryableOutcomes as readonly DiagnosticAttemptOutcome[]).includes(context.outcome)) {
    return { action: 'STOP', reason: 'OUTCOME_NOT_RETRYABLE' };
  }
  if (context.retriesUsed >= policy.maxRetries) {
    return { action: 'STOP', reason: 'RETRY_BUDGET_EXHAUSTED' };
  }
  return { action: 'RETRY', nextRetryIndex: context.retriesUsed + 1 };
}
