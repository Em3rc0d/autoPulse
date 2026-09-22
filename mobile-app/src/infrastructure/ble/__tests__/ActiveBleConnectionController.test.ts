import { activeBleController } from '../ActiveBleConnectionController';

describe('ActiveBleConnectionController ownership', () => {
  const buildConnection = (handle = 'conn-1') => ({
    connectionHandleId: handle,
    vehicleId: 'vehicle-1',
    adapterInstanceId: 'adapter-1',
    device: {
      isConnected: jest.fn().mockResolvedValue(true),
      cancelConnection: jest.fn().mockResolvedValue(undefined),
    },
    writeCharacteristic: {},
    receiveCharacteristic: {},
  } as any);

  beforeEach(() => {
    activeBleController.releaseConnection();
  });

  afterEach(() => {
    activeBleController.releaseConnection();
    jest.restoreAllMocks();
  });

  it('allows one owner at a time and rejects a concurrent Check claim during Live', () => {
    const connection = buildConnection();
    activeBleController.retainConnection(connection, 'LIVE');

    expect(activeBleController.claimConnection('conn-1', 'CHECK')).toBeNull();
    expect(activeBleController.getOwner()).toBe('LIVE');
    expect(activeBleController.getActiveConnection()).toBe(connection);
  });

  it('supports Live -> IDLE -> Check handoff without losing the physical connection', () => {
    const connection = buildConnection();
    activeBleController.retainConnection(connection, 'LIVE');

    activeBleController.releaseLease('LIVE');
    expect(activeBleController.getOwner()).toBe('IDLE');
    expect(activeBleController.getActiveConnection()).toBe(connection);

    expect(activeBleController.claimConnection('conn-1', 'CHECK')).toBe(connection);
    expect(activeBleController.getOwner()).toBe('CHECK');
  });

  it('physically disconnects and clears ownership after an unrecoverable terminal failure', async () => {
    const connection = buildConnection();
    activeBleController.retainConnection(connection, 'LIVE');

    await activeBleController.disconnectAndRelease();

    expect(connection.device.cancelConnection).toHaveBeenCalledTimes(1);
    expect(activeBleController.getActiveConnection()).toBeNull();
    expect(activeBleController.getOwner()).toBe('IDLE');
  });
});
