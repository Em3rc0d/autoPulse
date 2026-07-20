import { canTransitionEvaluation } from '../logic/evaluationStateMachine';
import { EvaluationState } from '../models/enums';
import { EvaluationErrorCodes } from '../errors/evaluationErrors';

describe('Evaluation State Machine', () => {
  it('allows transition from DRAFT to OPEN', () => {
    const result = canTransitionEvaluation(EvaluationState.DRAFT, EvaluationState.OPEN);
    expect(result.ok).toBe(true);
  });

  it('rejects transition from DRAFT to SIGNED', () => {
    const result = canTransitionEvaluation(EvaluationState.DRAFT, EvaluationState.SIGNED);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe(EvaluationErrorCodes.INVALID_TRANSITION);
    }
  });

  it('allows transition from READY_FOR_SIGNATURE to SIGNED', () => {
    const result = canTransitionEvaluation(EvaluationState.READY_FOR_SIGNATURE, EvaluationState.SIGNED);
    expect(result.ok).toBe(true);
  });

  it('treats SIGNED as immutable (cannot go back to OPEN)', () => {
    const result = canTransitionEvaluation(EvaluationState.SIGNED, EvaluationState.OPEN);
    expect(result.ok).toBe(false);
  });
});
