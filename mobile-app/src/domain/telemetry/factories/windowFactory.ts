import { TelemetryWindow } from '../models/telemetryWindow';
import { deepClone, deepFreeze } from '../../shared/immutability';

export function createFrozenTelemetryWindow(input: TelemetryWindow): TelemetryWindow {
  // Defensive copy
  const cloned = deepClone(input);
  // Deep freeze to guarantee runtime immutability
  return deepFreeze(cloned);
}
