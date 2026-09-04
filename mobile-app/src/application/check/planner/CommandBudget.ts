export interface CommandBudget {
  /** Total connector commands allowed for the whole plan, including retries. */
  readonly maxCommands: number;
  /** Total observed response bytes accepted across the whole plan. */
  readonly maxResponseBytes: number;
  /** Maximum observed bytes accepted from any one response. */
  readonly maxBytesPerResponse: number;
  /** Overall elapsed-time ceiling. Concrete values are profile/evidence supplied. */
  readonly maxElapsedMs: number;
  readonly provenance: string;
}

export interface CommandBudgetUsage {
  readonly commandsIssued: number;
  readonly responseBytes: number;
  readonly elapsedMs: number;
}

export type CommandBudgetBlockReason =
  | 'COMMAND_BUDGET_EXHAUSTED'
  | 'TOTAL_BYTE_BUDGET_EXHAUSTED'
  | 'RESPONSE_BYTE_CEILING_EXCEEDED'
  | 'ELAPSED_TIME_BUDGET_EXHAUSTED';

export type CommandBudgetDecision =
  | { readonly disposition: 'ALLOW' }
  | { readonly disposition: 'BLOCK'; readonly reason: CommandBudgetBlockReason };

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function assertValidCommandBudget(budget: CommandBudget): void {
  if (!Number.isInteger(budget.maxCommands) || budget.maxCommands < 1) {
    throw new Error('CommandBudget.maxCommands must be a positive integer');
  }
  if (!Number.isInteger(budget.maxResponseBytes) || budget.maxResponseBytes < 1) {
    throw new Error('CommandBudget.maxResponseBytes must be a positive integer');
  }
  if (!Number.isInteger(budget.maxBytesPerResponse) || budget.maxBytesPerResponse < 1) {
    throw new Error('CommandBudget.maxBytesPerResponse must be a positive integer');
  }
  if (!Number.isInteger(budget.maxElapsedMs) || budget.maxElapsedMs < 1) {
    throw new Error('CommandBudget.maxElapsedMs must be a positive integer');
  }
  if (budget.maxBytesPerResponse > budget.maxResponseBytes) {
    throw new Error('CommandBudget.maxBytesPerResponse cannot exceed maxResponseBytes');
  }
  if (!budget.provenance.trim()) throw new Error('CommandBudget.provenance must be non-empty');
}

export function evaluateBudgetBeforeCommand(
  budget: CommandBudget,
  usage: CommandBudgetUsage,
): CommandBudgetDecision {
  assertValidCommandBudget(budget);
  if (!finiteNonNegative(usage.commandsIssued) || !finiteNonNegative(usage.responseBytes) || !finiteNonNegative(usage.elapsedMs)) {
    throw new Error('CommandBudgetUsage must contain finite non-negative values');
  }
  if (usage.commandsIssued >= budget.maxCommands) {
    return { disposition: 'BLOCK', reason: 'COMMAND_BUDGET_EXHAUSTED' };
  }
  if (usage.responseBytes >= budget.maxResponseBytes) {
    return { disposition: 'BLOCK', reason: 'TOTAL_BYTE_BUDGET_EXHAUSTED' };
  }
  if (usage.elapsedMs >= budget.maxElapsedMs) {
    return { disposition: 'BLOCK', reason: 'ELAPSED_TIME_BUDGET_EXHAUSTED' };
  }
  return { disposition: 'ALLOW' };
}

export function evaluateObservedResponseBytes(
  budget: CommandBudget,
  usageBeforeResponse: CommandBudgetUsage,
  observedResponseBytes: number,
): CommandBudgetDecision {
  assertValidCommandBudget(budget);
  if (!Number.isInteger(observedResponseBytes) || observedResponseBytes < 0) {
    throw new Error('observedResponseBytes must be a non-negative integer');
  }
  if (observedResponseBytes > budget.maxBytesPerResponse) {
    return { disposition: 'BLOCK', reason: 'RESPONSE_BYTE_CEILING_EXCEEDED' };
  }
  if (usageBeforeResponse.responseBytes + observedResponseBytes > budget.maxResponseBytes) {
    return { disposition: 'BLOCK', reason: 'TOTAL_BYTE_BUDGET_EXHAUSTED' };
  }
  return { disposition: 'ALLOW' };
}

export function recordCommandIssued(usage: CommandBudgetUsage): CommandBudgetUsage {
  return Object.freeze({ ...usage, commandsIssued: usage.commandsIssued + 1 });
}

export function recordObservedResponseBytes(
  usage: CommandBudgetUsage,
  observedResponseBytes: number,
): CommandBudgetUsage {
  if (!Number.isInteger(observedResponseBytes) || observedResponseBytes < 0) {
    throw new Error('observedResponseBytes must be a non-negative integer');
  }
  return Object.freeze({ ...usage, responseBytes: usage.responseBytes + observedResponseBytes });
}
