import { LiveSessionState } from '../models/enums';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { TelemetryErrorCodes, createTelemetryError } from '../errors/telemetryErrors';

export function canTransitionLiveSession(current: LiveSessionState, next: LiveSessionState): Result<boolean, DomainError> {
  const allowedTransitions: Record<LiveSessionState, LiveSessionState[]> = {
    [LiveSessionState.CREATED]: [LiveSessionState.CONNECTING, LiveSessionState.ABORTED],
    [LiveSessionState.CONNECTING]: [LiveSessionState.STREAMING, LiveSessionState.FAILED, LiveSessionState.ABORTED],
    [LiveSessionState.STREAMING]: [LiveSessionState.PAUSED, LiveSessionState.INTERRUPTED, LiveSessionState.COMPLETED, LiveSessionState.ABORTED],
    [LiveSessionState.PAUSED]: [LiveSessionState.STREAMING, LiveSessionState.COMPLETED, LiveSessionState.ABORTED],
    [LiveSessionState.COMPLETED]: [],
    [LiveSessionState.INTERRUPTED]: [LiveSessionState.CONNECTING, LiveSessionState.COMPLETED, LiveSessionState.ABORTED],
    [LiveSessionState.FAILED]: [LiveSessionState.CONNECTING, LiveSessionState.ABORTED],
    [LiveSessionState.ABORTED]: []
  };

  if (allowedTransitions[current].includes(next)) {
    return success(true);
  }

  return failure(createTelemetryError(
    TelemetryErrorCodes.INVALID_SESSION_TRANSITION,
    `Cannot transition LiveSession from ${current} to ${next}`,
    { current, next }
  ));
}
