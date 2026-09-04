import { decideRetry, RetryPolicy } from '../RetryPolicy';

const policy: RetryPolicy = {
  maxRetries: 2,
  retryableOutcomes: ['TIMEOUT', 'FAILED'],
  responsePending: { maxExtensions: 2, extensionMs: 200 },
  provenance: 'fixture',
};

describe('CHECK-MK5 RetryPolicy', () => {
  it('retries only explicitly configured recoverable outcomes', () => {
    expect(decideRetry(policy, {
      outcome: 'TIMEOUT', retriesUsed: 0, pendingExtensionsUsed: 0, remainingMs: 1000,
    })).toEqual({ action: 'RETRY', nextRetryIndex: 1 });

    expect(decideRetry(policy, {
      outcome: 'NO_DATA', retriesUsed: 0, pendingExtensionsUsed: 0, remainingMs: 1000,
    })).toEqual({ action: 'STOP', reason: 'OUTCOME_NOT_RETRYABLE' });

    expect(decideRetry(policy, {
      outcome: 'UNSUPPORTED', retriesUsed: 0, pendingExtensionsUsed: 0, remainingMs: 1000,
    })).toEqual({ action: 'STOP', reason: 'OUTCOME_NOT_RETRYABLE' });
  });

  it('stops when the retry budget is exhausted', () => {
    expect(decideRetry(policy, {
      outcome: 'FAILED', retriesUsed: 2, pendingExtensionsUsed: 0, remainingMs: 1000,
    })).toEqual({ action: 'STOP', reason: 'RETRY_BUDGET_EXHAUSTED' });
  });

  it('treats RESPONSE_PENDING as bounded continuation, not as a retry', () => {
    expect(decideRetry(policy, {
      outcome: 'RESPONSE_PENDING', retriesUsed: 2, pendingExtensionsUsed: 0, remainingMs: 1000,
    })).toEqual({
      action: 'WAIT_PENDING', extensionMs: 200, nextPendingExtensionIndex: 1,
    });
  });

  it('blocks pending continuation when extension budget or deadline is exhausted', () => {
    expect(decideRetry(policy, {
      outcome: 'RESPONSE_PENDING', retriesUsed: 0, pendingExtensionsUsed: 2, remainingMs: 1000,
    })).toEqual({ action: 'STOP', reason: 'PENDING_EXTENSION_BUDGET_EXHAUSTED' });

    expect(decideRetry(policy, {
      outcome: 'RESPONSE_PENDING', retriesUsed: 0, pendingExtensionsUsed: 0, remainingMs: 200,
    })).toEqual({ action: 'STOP', reason: 'PENDING_WOULD_CROSS_DEADLINE' });
  });

  it('completes successful DTC outcomes without retrying', () => {
    expect(decideRetry(policy, {
      outcome: 'SUCCESS_ZERO_CODES', retriesUsed: 0, pendingExtensionsUsed: 0, remainingMs: 1000,
    })).toEqual({ action: 'COMPLETE', reason: 'SUCCESS' });
  });
});
