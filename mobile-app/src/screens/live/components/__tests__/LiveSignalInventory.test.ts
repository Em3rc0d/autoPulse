import { buildLiveSignalInventory, signalIdForPid } from '../LiveSignalInventory';

describe('LiveSignalInventory', () => {
  it('maps supported OBD PIDs into canonical driver-intelligence signals', () => {
    const inventory = buildLiveSignalInventory(['010C', '0105', '0104', '0111', '0142']);

    expect(inventory.map(signal => signal.signalId)).toEqual([
      'ENGINE_RPM',
      'ENGINE_COOLANT',
      'ENGINE_LOAD',
      'THROTTLE_POSITION',
      'CONTROL_VOLTAGE',
    ]);
    expect(inventory.every(signal => signal.origin === 'ECU_DIRECT')).toBe(true);
  });

  it('lets successful observations upgrade initial degraded capability evidence', () => {
    const inventory = buildLiveSignalInventory(
      ['010C', '0105'],
      [
        { signalId: 'ENGINE_RPM', quality: 'VALID' },
        { signalId: 'ENGINE_COOLANT', quality: 'VALID' },
        { signalId: 'ADAPTER_VOLTAGE', quality: 'VALID' },
      ],
    );

    expect(inventory.find(signal => signal.signalId === 'ENGINE_RPM')?.quality).toBe('VALID');
    expect(inventory.find(signal => signal.signalId === 'ADAPTER_VOLTAGE')).toEqual(
      expect.objectContaining({ origin: 'DEVICE_SENSOR', quality: 'VALID' }),
    );
  });

  it('does not manufacture unsupported signals', () => {
    expect(signalIdForPid('9999')).toBeUndefined();
    expect(buildLiveSignalInventory(['9999'])).toEqual([]);
  });
});
