import { canTransitionCapture } from '../logic/captureStateMachine';
import { CaptureState } from '../models/enums';
import { EvaluationErrorCodes } from '../errors/evaluationErrors';

describe('Capture State Machine', () => {
  it('allows transition from CREATED to CONNECTING', () => {
    const result = canTransitionCapture(CaptureState.CREATED, CaptureState.CONNECTING);
    expect(result.ok).toBe(true);
  });

  it('allows transition from CONNECTED to CAPTURING', () => {
    const result = canTransitionCapture(CaptureState.CONNECTED, CaptureState.CAPTURING);
    expect(result.ok).toBe(true);
  });

  it('rejects transition from COMPLETED to RUNNING (CONNECTING/CAPTURING)', () => {
    const result = canTransitionCapture(CaptureState.COMPLETED, CaptureState.CAPTURING);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe(EvaluationErrorCodes.INVALID_TRANSITION);
    }
  });
});
