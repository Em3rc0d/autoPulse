import { LiveTelemetrySession } from '../models/liveTelemetrySession';
import { TelemetryFrame } from '../models/telemetryFrame';
import { TelemetryWindow } from '../models/telemetryWindow';
import { TelemetryMarker } from '../models/telemetryMarker';
import { Result, success, failure } from '../../shared/result';
import { DomainError } from '../../shared/domainError';
import { TelemetryErrorCodes, createTelemetryError } from '../errors/telemetryErrors';

export function freezeTelemetryWindow(
  session: LiveTelemetrySession,
  frames: readonly TelemetryFrame[],
  markers: readonly TelemetryMarker[]
): Result<TelemetryWindow, DomainError> {
  if (frames.length === 0) {
    return failure(createTelemetryError(
      TelemetryErrorCodes.INVALID_WINDOW,
      'Cannot create an empty telemetry window'
    ));
  }

  const sortedFrames = [...frames].sort((a, b) => a.elapsedMs - b.elapsedMs);
  const startedAt = sortedFrames[0].timestamp;
  const endedAt = sortedFrames[sortedFrames.length - 1].timestamp;

  return success({
    sessionId: session.id,
    startedAt,
    endedAt,
    frames: sortedFrames,
    markers: [...markers],
    signalDefinitions: [], // Should be injected or mapped
    capabilitySnapshot: session.capabilitySnapshot
  });
}
