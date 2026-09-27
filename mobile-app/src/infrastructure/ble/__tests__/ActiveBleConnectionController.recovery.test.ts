import { activeBleController } from '../ActiveBleConnectionController';

function connection(isConnected: jest.Mock) {
  return {
    connectionHandleId: 'handoff-1',
    device: {
      isConnected,
      cancelConnection: jest.fn().mockResolvedValue(undefined),
    },
    writeCharacteristic: { serviceUuid: 's', uuid: 'w', isWritableWithResponse: true },
    receiveCharacteristic: { serviceUuid: 's', uuid: 'r', isNotifiable: true },
  } as any;
}

describe('ActiveBleConnectionController stale-link recovery', () => {
  afterEach(async () => {
    await activeBleController.disconnectAndRelease();
  });

  it('reuses an IDLE retained connection only while BLE is physically connected', async () => {
    const retained = connection(jest.fn().mockResolvedValue(true));
    activeBleController.retainConnection(retained, 'IDLE');

    await expect(activeBleController.getReusableIdleConnection()).resolves.toBe(retained);
    expect(activeBleController.getActiveConnection()).toBe(retained);
  });

  it('invalidates a stale IDLE handle instead of forcing an app restart', async () => {
    const retained = connection(jest.fn().mockResolvedValue(false));
    activeBleController.retainConnection(retained, 'IDLE');

    await expect(activeBleController.getReusableIdleConnection()).resolves.toBeNull();
    expect(activeBleController.getActiveConnection()).toBeNull();
    expect(activeBleController.getOwner()).toBe('IDLE');
  });

  it('clears the previous IDLE link before an explicit fresh connection attempt', async () => {
    const retained = connection(jest.fn().mockResolvedValue(true));
    activeBleController.retainConnection(retained, 'IDLE');

    await expect(activeBleController.prepareForFreshConnection()).resolves.toBe(true);
    expect(retained.device.cancelConnection).toHaveBeenCalledTimes(1);
    expect(activeBleController.getActiveConnection()).toBeNull();
  });

  it('does not steal or disconnect a connection owned by an active workflow', async () => {
    const retained = connection(jest.fn().mockResolvedValue(true));
    activeBleController.retainConnection(retained, 'LIVE');

    await expect(activeBleController.prepareForFreshConnection()).resolves.toBe(false);
    expect(retained.device.cancelConnection).not.toHaveBeenCalled();
    expect(activeBleController.getOwner()).toBe('LIVE');
  });
});
