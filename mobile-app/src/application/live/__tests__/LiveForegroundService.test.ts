const mockStart = jest.fn();
const mockStopAll = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@supersami/rn-foreground-service', () => ({
  __esModule: true,
  default: {
    start: mockStart,
    stopAll: mockStopAll,
  },
}));

import {
  getLiveForegroundServiceState,
  reportLiveForegroundServiceFailure,
  startLiveForegroundService,
  stopLiveForegroundService,
  subscribeLiveForegroundServiceFailure,
} from '../LiveForegroundService';

describe('LiveForegroundService native async lifecycle', () => {
  beforeEach(async () => {
    // Always finish cleanup from the preceding test before resetting mocks.
    mockStopAll.mockResolvedValue(undefined);
    await stopLiveForegroundService();
    mockStart.mockReset().mockResolvedValue(undefined);
    mockStopAll.mockReset().mockResolvedValue(undefined);
  });

  it('starts only after the native promise resolves, and remains idempotent', async () => {
    let resolveNative!: () => void;
    mockStart.mockImplementationOnce(() => new Promise<void>(resolve => { resolveNative = resolve; }));

    const first = startLiveForegroundService();
    const second = startLiveForegroundService();
    expect(first).toBe(second);
    await Promise.resolve();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(getLiveForegroundServiceState().running).toBe(false);

    resolveNative();
    expect(await first).toBe(true);
    expect(getLiveForegroundServiceState().running).toBe(true);
    expect(await startLiveForegroundService()).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);

    await stopLiveForegroundService();
    expect(mockStopAll).toHaveBeenCalledTimes(1);
    expect(getLiveForegroundServiceState().running).toBe(false);
  });

  it('fails closed if the native start rejects asynchronously', async () => {
    mockStart.mockRejectedValueOnce(new Error('native start failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(await startLiveForegroundService()).toBe(false);
      expect(getLiveForegroundServiceState()).toEqual({
        running: false, lastFailure: 'FOREGROUND_SERVICE_START_FAILED',
      });
      await stopLiveForegroundService();
    } finally {
      warn.mockRestore();
    }
  });

  it('serializes stop before a subsequent start, with no late resurrection', async () => {
    let resolveNative!: () => void;
    mockStart.mockImplementationOnce(() => new Promise<void>(resolve => { resolveNative = resolve; }));

    const oldStart = startLiveForegroundService();
    await Promise.resolve();
    const stop = stopLiveForegroundService();
    const newStart = startLiveForegroundService();
    expect(getLiveForegroundServiceState().running).toBe(false);

    resolveNative();
    expect(await oldStart).toBe(false);
    await stop;
    expect(mockStopAll).toHaveBeenCalledTimes(1);
    expect(await newStart).toBe(true);
    expect(getLiveForegroundServiceState().running).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('isolates broken subscribers and invalidates a pending native start', async () => {
    const bad = jest.fn(() => { throw new Error('unmounted'); });
    const good = jest.fn();
    const unsubBad = subscribeLiveForegroundServiceFailure(bad);
    const unsubGood = subscribeLiveForegroundServiceFailure(good);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      let resolveNative!: () => void;
      mockStart.mockImplementationOnce(() => new Promise<void>(resolve => { resolveNative = resolve; }));
      const pending = startLiveForegroundService();
      await Promise.resolve();
      expect(() => reportLiveForegroundServiceFailure('NATIVE_SERVICE_CRASH')).not.toThrow();
      resolveNative();
      expect(await pending).toBe(false);
      expect(good).toHaveBeenCalledWith('NATIVE_SERVICE_CRASH');
      expect(warn).toHaveBeenCalledTimes(1);
      await stopLiveForegroundService();
    } finally {
      unsubBad();
      unsubGood();
      warn.mockRestore();
    }
  });

  it('does not notify detached controllers about later errors', () => {
    const old = jest.fn();
    const active = jest.fn();
    const unsubscribeOld = subscribeLiveForegroundServiceFailure(old);
    const unsubscribeActive = subscribeLiveForegroundServiceFailure(active);
    unsubscribeOld();
    try {
      reportLiveForegroundServiceFailure('NATIVE_SERVICE_CRASH');
      expect(old).not.toHaveBeenCalled();
      expect(active).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribeActive();
    }
  });

  it('fails closed when native stop rejects rather than declaring clean shutdown', async () => {
    expect(await startLiveForegroundService()).toBe(true);
    mockStopAll.mockRejectedValueOnce(new Error('stop rejected'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await expect(stopLiveForegroundService()).rejects.toThrow('stop rejected');
      expect(getLiveForegroundServiceState()).toEqual({
        running: false, lastFailure: 'FOREGROUND_SERVICE_STOP_FAILED',
      });
      expect(await startLiveForegroundService()).toBe(false);
    } finally {
      warn.mockRestore();
      // The following test's beforeEach retries native cleanup successfully.
    }
  });
});
