import { deepClone, deepFreeze } from '../immutability';
import { createFrozenTelemetryWindow } from '../../telemetry/factories/windowFactory';
import { TelemetryWindow } from '../../telemetry/models/telemetryWindow';
import { createLiveSessionId } from '../identifiers';
import { nowUtc } from '../timestamps';

describe('Immutability Utilities', () => {
  it('prevents mutation of arrays and nested objects', () => {
    const originalArray = [{ id: 1 }, { id: 2 }];
    const windowInput: TelemetryWindow = {
      sessionId: createLiveSessionId('session-1'),
      startedAt: nowUtc(),
      endedAt: nowUtc(),
      frames: originalArray as any,
      markers: [],
      signalDefinitions: []
    };

    const frozenWindow = createFrozenTelemetryWindow(windowInput);

    // 1. Modificar el array original no afecta al frozen
    originalArray.push({ id: 3 });
    expect(frozenWindow.frames.length).toBe(2);

    // 2. Modificar una propiedad anidada del array original no afecta al frozen
    originalArray[0].id = 99;
    expect(Object.isFrozen(frozenWindow)).toBe(true);
    expect(Object.isFrozen(frozenWindow.frames)).toBe(true);
  });
});
