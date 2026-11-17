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

describe('LiveForegroundService', () => {
  beforeEach(() => {
    mockStart.mockReset();
    mockStopAll.mockReset();
    stopLiveForegroundService();
  });


  it('starts once per active Live session and can start again after stop', () => {
    expect(startLiveForegroundService()).toBe(true);
    expect(startLiveForegroundService()).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);
    stopLiveForegroundService();
    expect(mockStopAll).toHaveBeenCalledTimes(1);
    expect(getLiveForegroundServiceState().running).toBe(false);
    expect(startLiveForegroundService()).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(2);
    stopLiveForegroundService();
    expect(mockStopAll).toHaveBeenCalledTimes(2);
  });

  it('isolates broken notification observers and still tells the healthy Live subscriber', () => {
    const bad = jest.fn(() => { throw new Error('unmounted'); });
    const good = jest.fn();
    const unsubBad = subscribeLiveForegroundServiceFailure(bad);
    const unsubGood = subscribeLiveForegroundServiceFailure(good);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(() => reportLiveForegroundServiceFailure('NATIVE_SERVICE_CRASH')).not.toThrow();
      expect(good).toHaveBeenCalledWith('NATIVE_SERVICE_CRASH');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      unsubBad();
      unsubGood();
      warn.mockRestore();
    }
  });

  it('unsubscribed controllers never receive later Android foreground events', () => {
    const obsolete = jest.fn();
    const active = jest.fn();
    const unsubscribeOld = subscribeLiveForegroundServiceFailure(obsolete);
    const unsubscribeNew = subscribeLiveForegroundServiceFailure(active);
    unsubscribeOld();
    try {
      reportLiveForegroundServiceFailure('NATIVE_SERVICE_CRASH');
      expect(obsolete).not.toHaveBeenCalled();
      expect(active).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribeNew();
    }
  });

  it('clears a previous failure once a new foreground session starts', () => {
    reportLiveForegroundServiceFailure('FOREGROUND_SERVICE_NATIVE_ERROR');
    expect(getLiveForegroundServiceState().lastFailure).toBe('FOREGROUND_SERVICE_NATIVE_ERROR');
    expect(startLiveForegroundService()).toBe(true);
    expect(getLiveForegroundServiceState()).toEqual({running:true,lastFailure:null});
  });

  it('reports a successful Android foreground-service start', () => {
    expect(startLiveForegroundService()).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(getLiveForegroundServiceState()).toEqual({ running: true, lastFailure: null });
  });

  it('fails closed when the native start call throws', () => {
    mockStart.mockImplementationOnce(() => {
      throw new Error('native start failed');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(startLiveForegroundService()).toBe(false);
    expect(getLiveForegroundServiceState()).toEqual({
      running: false,
      lastFailure: 'FOREGROUND_SERVICE_START_FAILED',
    });

    warn.mockRestore();
  });

  it('notifies the Live controller boundary when Android later reports service failure', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLiveForegroundServiceFailure(listener);

    reportLiveForegroundServiceFailure('FOREGROUND_SERVICE_NATIVE_ERROR');

    expect(listener).toHaveBeenCalledWith('FOREGROUND_SERVICE_NATIVE_ERROR');
    expect(getLiveForegroundServiceState().running).toBe(false);

    unsubscribe();
  });
});
