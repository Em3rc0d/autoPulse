import { canTransitionLiveSession } from '../logic/liveSessionStateMachine';
import { LiveSessionState } from '../models/enums';
import { TelemetryErrorCodes } from '../errors/telemetryErrors';

describe('Live Session State Machine', () => {
  it('allows transition from CONNECTING to STREAMING', () => {
    const result = canTransitionLiveSession(LiveSessionState.CONNECTING, LiveSessionState.STREAMING);
    expect(result.ok).toBe(true);
  });

  it('allows pause and resume', () => {
    expect(canTransitionLiveSession(LiveSessionState.STREAMING, LiveSessionState.PAUSED).ok).toBe(true);
    expect(canTransitionLiveSession(LiveSessionState.PAUSED, LiveSessionState.STREAMING).ok).toBe(true);
  });

  it('rejects transition from COMPLETED to STREAMING', () => {
    const result = canTransitionLiveSession(LiveSessionState.COMPLETED, LiveSessionState.STREAMING);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe(TelemetryErrorCodes.INVALID_SESSION_TRANSITION);
    }
  });
});
