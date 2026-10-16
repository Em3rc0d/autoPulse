import {
  assertValidCommandBudget,
  evaluateBudgetBeforeCommand,
  evaluateInterCommandPacing,
  evaluateObservedResponseBytes,
  recordCommandIssued,
  recordObservedResponseBytes,
} from '../CommandBudget';

const budget = {
  maxCommands: 3,
  maxResponseBytes: 12,
  maxBytesPerResponse: 8,
  maxElapsedMs: 1000,
  minInterCommandDelayMs: 50,
  provenance: 'fixture',
} as const;

describe('CHECK-MK5 CommandBudget', () => {
  it('blocks deterministically on command, byte and elapsed ceilings', () => {
    expect(evaluateBudgetBeforeCommand(budget, { commandsIssued: 2, responseBytes: 5, elapsedMs: 500 })).toEqual({ disposition: 'ALLOW' });
    expect(evaluateBudgetBeforeCommand(budget, { commandsIssued: 3, responseBytes: 5, elapsedMs: 500 })).toEqual({
      disposition: 'BLOCK', reason: 'COMMAND_BUDGET_EXHAUSTED',
    });
    expect(evaluateBudgetBeforeCommand(budget, { commandsIssued: 1, responseBytes: 12, elapsedMs: 500 })).toEqual({
      disposition: 'BLOCK', reason: 'TOTAL_BYTE_BUDGET_EXHAUSTED',
    });
    expect(evaluateBudgetBeforeCommand(budget, { commandsIssued: 1, responseBytes: 5, elapsedMs: 1000 })).toEqual({
      disposition: 'BLOCK', reason: 'ELAPSED_TIME_BUDGET_EXHAUSTED',
    });
  });

  it('enforces profile-supplied inter-command pacing without inventing a runtime delay', () => {
    expect(evaluateInterCommandPacing(budget, 100)).toEqual({ disposition: 'ALLOW' });
    expect(evaluateInterCommandPacing(budget, 149, 100)).toEqual({
      disposition: 'BLOCK', reason: 'INTER_COMMAND_DELAY_NOT_SATISFIED',
    });
    expect(evaluateInterCommandPacing(budget, 150, 100)).toEqual({ disposition: 'ALLOW' });
    expect(() => evaluateInterCommandPacing(budget, 90, 100)).toThrow('not after now');
  });

  it('caps each response and the accumulated response bytes', () => {
    expect(evaluateObservedResponseBytes(budget, { commandsIssued: 1, responseBytes: 2, elapsedMs: 10 }, 8)).toEqual({ disposition: 'ALLOW' });
    expect(evaluateObservedResponseBytes(budget, { commandsIssued: 1, responseBytes: 2, elapsedMs: 10 }, 9)).toEqual({
      disposition: 'BLOCK', reason: 'RESPONSE_BYTE_CEILING_EXCEEDED',
    });
    expect(evaluateObservedResponseBytes(budget, { commandsIssued: 1, responseBytes: 6, elapsedMs: 10 }, 7)).toEqual({
      disposition: 'BLOCK', reason: 'TOTAL_BYTE_BUDGET_EXHAUSTED',
    });
  });

  it('records usage immutably', () => {
    const initial = { commandsIssued: 0, responseBytes: 0, elapsedMs: 0 };
    const command = recordCommandIssued(initial);
    const response = recordObservedResponseBytes(command, 5);
    expect(initial).toEqual({ commandsIssued: 0, responseBytes: 0, elapsedMs: 0 });
    expect(command.commandsIssued).toBe(1);
    expect(response.responseBytes).toBe(5);
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(response)).toBe(true);
  });

  it('rejects invalid or internally inconsistent budgets', () => {
    expect(() => assertValidCommandBudget({ ...budget, maxCommands: 0 })).toThrow('positive integer');
    expect(() => assertValidCommandBudget({ ...budget, maxBytesPerResponse: 13 })).toThrow('cannot exceed');
    expect(() => assertValidCommandBudget({ ...budget, minInterCommandDelayMs: -1 })).toThrow('non-negative integer');
  });
});
