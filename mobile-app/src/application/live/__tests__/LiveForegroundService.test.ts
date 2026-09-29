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
