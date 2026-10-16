import { activeBleController as lease } from '../ActiveBleConnectionController';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function connection(id: string, device: any = {}) {
  return {
    connectionHandleId: id,
    device: {
      id: id + '-device',
      isConnected: jest.fn(async () => false),
      cancelConnection: jest.fn(async () => undefined),
      connect: jest.fn(async () => device),
      discoverAllServicesAndCharacteristics: jest.fn(async () => undefined),
      ...device,
    },
    writeCharacteristic: {} as any,
    receiveCharacteristic: {} as any,
  };
}

describe('Active BLE lease — adversarial native race regression', () => {
  beforeEach(() => {
    jest.useRealTimers();
    lease.releaseConnection();
  });
  afterEach(() => { lease.releaseConnection(); });


  it('hands an idle adapter Live → Check → Live without creating a second device', async () => {
    const original = connection('handoff-cycle');
    lease.retainConnection(original as any);
    expect(lease.claimConnection('handoff-cycle', 'LIVE')).toBe(original);
    expect(lease.claimConnection('handoff-cycle', 'CHECK')).toBeNull();
    lease.releaseClaim('LIVE');
    expect(lease.claimConnection('handoff-cycle', 'CHECK')).toBe(original);
    expect(lease.claimConnection('handoff-cycle', 'LIVE')).toBeNull();
    lease.releaseClaim('CHECK');
    expect(lease.claimConnection('handoff-cycle', 'LIVE')).toBe(original);
    expect(lease.getOwner()).toBe('LIVE');
    expect(original.device.connect).not.toHaveBeenCalled();
    expect(original.device.cancelConnection).not.toHaveBeenCalled();
  });

  it('rejects a different physical adapter at idle until old native link disconnects', () => {
    lease.retainConnection(connection('first') as any);
    expect(() => lease.retainConnection(connection('second') as any))
      .toThrow('BLE_IDLE_CONNECTION_REQUIRES_DISCONNECT');
    expect(lease.getConnection('first')).not.toBeNull();
    expect(lease.getConnection('second')).toBeNull();
  });

  it('does not let a stale owner release a newer Check claim', () => {
    const current = connection('stale');
    lease.retainConnection(current as any);
    lease.claimConnection('stale', 'LIVE');
    lease.releaseClaim('LIVE');
    lease.claimConnection('stale', 'CHECK');
    lease.releaseClaim('LIVE');
    expect(lease.getOwner()).toBe('CHECK');
    expect(lease.getConnection('stale')).toBe(current);
  });

  it('cancellation after discovery must not promote an invalidated reconnect', async () => {
    const pending = deferred<any>();
    const conn = connection('discovery', {
      discoverAllServicesAndCharacteristics: jest.fn(() => pending.promise),
    });
    lease.retainConnection(conn as any);
    lease.claimConnection('discovery', 'CHECK');
    const recovery = lease.reconnectClaimedConnection('discovery', 'CHECK');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(conn.device.discoverAllServicesAndCharacteristics).toHaveBeenCalledTimes(1);
    lease.releaseClaim('CHECK');
    lease.claimConnection('discovery', 'LIVE');
    pending.resolve(conn.device);
    expect(await recovery).toBeNull();
    expect(lease.getOwner()).toBe('LIVE');
    expect(lease.getConnection('discovery')).toBe(conn);
  });

  it('removes one subscriber without muting surviving BLE observers', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribe = lease.subscribe(first);
    const unsubscribeSecond = lease.subscribe(second);
    try {
      lease.retainConnection(connection('notifications') as any);
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      unsubscribe();
      lease.releaseConnection();
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
      unsubscribeSecond();
    }
  });

  it('retains a successful claimed Check reconnect', async () => {
    const device = connection('success');
    device.device.connect.mockResolvedValue(device.device);
    lease.retainConnection(device as any);
    lease.claimConnection('success', 'CHECK');
    const recovered = await lease.reconnectClaimedConnection('success', 'CHECK');
    expect(recovered?.device).toBe(device.device);
    expect(lease.getOwner()).toBe('CHECK');
    expect(device.device.discoverAllServicesAndCharacteristics).toHaveBeenCalledTimes(1);
  });

  it('does not connect after Check relinquishes its lease during native isConnected()', async () => {
    const inFlight = deferred<boolean>();
    const conn = connection('released', { isConnected: jest.fn(() => inFlight.promise) });
    lease.retainConnection(conn as any);
    lease.claimConnection('released', 'CHECK');
    const reconnecting = lease.reconnectClaimedConnection('released', 'CHECK');
    lease.releaseClaim('CHECK');
    inFlight.resolve(false);
    expect(await reconnecting).toBeNull();
    expect(conn.device.connect).not.toHaveBeenCalled();
    expect(lease.getOwner()).toBe('IDLE');
  });

  it('does not replace a new LIVE owner after Check releases while connect is pending', async () => {
    const inFlight = deferred<any>();
    const conn = connection('handoff', { connect: jest.fn(() => inFlight.promise) });
    lease.retainConnection(conn as any);
    lease.claimConnection('handoff', 'CHECK');
    const reconnecting = lease.reconnectClaimedConnection('handoff', 'CHECK');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(conn.device.connect).toHaveBeenCalledTimes(1);
    lease.releaseClaim('CHECK');
    lease.claimConnection('handoff', 'LIVE');
    inFlight.resolve(conn.device);
    expect(await reconnecting).toBeNull();
    expect(lease.getOwner()).toBe('LIVE');
    expect(lease.getConnection('handoff')).toBe(conn);
  });

  it('a late Check connect failure cannot disconnect a newer LIVE owner', async () => {
    const inFlight = deferred<any>();
    const conn = connection('late-error', { connect: jest.fn(() => inFlight.promise) });
    lease.retainConnection(conn as any);
    lease.claimConnection('late-error', 'CHECK');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const disconnect = jest.spyOn(lease, 'disconnectAndRelease');
    try {
      const reconnecting = lease.reconnectClaimedConnection('late-error', 'CHECK');
      await new Promise(resolve => setTimeout(resolve, 300));
      lease.releaseClaim('CHECK');
      lease.claimConnection('late-error', 'LIVE');
      inFlight.reject(new Error('native GATT failure after claim handoff'));
      expect(await reconnecting).toBeNull();
      expect(disconnect).not.toHaveBeenCalled();
      expect(lease.getOwner()).toBe('LIVE');
    } finally {
      disconnect.mockRestore();
      warn.mockRestore();
    }
  });

  it('cancellation while native connect is pending cannot reattach a stale Check lease', async () => {
    const inFlight = deferred<any>();
    const conn = connection('cancel', { connect: jest.fn(() => inFlight.promise) });
    lease.retainConnection(conn as any);
    lease.claimConnection('cancel', 'CHECK');
    let cancelled = false;
    const reconnecting = lease.reconnectClaimedConnection('cancel', 'CHECK', () => cancelled);
    await new Promise(resolve => setTimeout(resolve, 300));
    cancelled = true;
    inFlight.resolve(conn.device);
    expect(await reconnecting).toBeNull();
    expect(conn.device.discoverAllServicesAndCharacteristics).not.toHaveBeenCalled();
  });

  it('does not acquire a connection during unfinished native teardown', async () => {
    const inFlight = deferred<boolean>();
    const old = connection('old', { isConnected: jest.fn(() => inFlight.promise) });
    lease.retainConnection(old as any, 'LIVE');
    const pendingStop = lease.disconnectAndRelease();
    expect(lease.getOwner()).toBe('IDLE');
    expect(() => lease.retainConnection(connection('new') as any)).toThrow('BLE_TEARDOWN_PENDING');
    expect(lease.claimConnection('old', 'CHECK')).toBeNull();
    inFlight.resolve(false);
    await pendingStop;
    lease.retainConnection(connection('new') as any);
    expect(lease.getConnection('new')).not.toBeNull();
  });

  it('isolates exceptions thrown by BLE connection observers', () => {
    const bad = jest.fn(() => { throw new Error('React component unmounted'); });
    const good = jest.fn();
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unBad = lease.subscribe(bad);
    const unGood = lease.subscribe(good);
    try {
      expect(() => lease.retainConnection(connection('observers') as any)).not.toThrow();
      expect(good).toHaveBeenCalledTimes(1);
      expect(lease.getConnection('observers')).not.toBeNull();
    } finally {
      unBad();
      unGood();
      warning.mockRestore();
    }
  });
});
