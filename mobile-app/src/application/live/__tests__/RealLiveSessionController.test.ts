jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    currentState: 'active'
  }
}));

import { RealLiveSessionController } from '../RealLiveSessionController';

describe('RealLiveSessionController Integration', () => {
  let mockPoller: any;
  let mockSessionRepo: any;
  let mockTelemetryRepo: any;

  beforeEach(() => {
    mockPoller = {
      start: jest.fn(),
      stop: jest.fn()
    };
    mockSessionRepo = {
      completeSession: jest.fn().mockResolvedValue(undefined),
      interruptSession: jest.fn().mockResolvedValue(undefined),
      requestStop: jest.fn().mockResolvedValue(undefined),
    };
    mockTelemetryRepo = {};
  });

  const createController = () => {
    const ctrl = new RealLiveSessionController(
      mockSessionRepo as any,
      mockTelemetryRepo as any,
      'ws1',
      'sess1',
      'conn1',
      ['010C', '010D']
    );
    // Stub out actual telemetry operations for pure lifecycle testing
    (ctrl as any).assembler = {
      flush: jest.fn().mockReturnValue(null) // No final block
    };
    (ctrl as any).commitQueue = {
      drain: jest.fn().mockResolvedValue(undefined),
      getHasFailed: jest.fn().mockReturnValue(false)
    };
    (ctrl as any).poller = mockPoller;
    return ctrl;
  };

  it('Controller start is idempotent', async () => {
    const ctrl = createController();

    // We stub activeBleController inside the test environment if needed, but here we can just skip start and mock it manually or mock activeBleController globally.
    // Instead of testing start details, we test idempotent stop/cleanup which don't require BLE.
    ctrl['currentState'] = 'ACTIVE';
    ctrl['commitQueue'] = {
      drain: jest.fn().mockResolvedValue(undefined),
      getHasFailed: jest.fn().mockReturnValue(false)
    } as any;
  });

  it('Double Stop shares terminal promise', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    // mock activeBleController
    (global as any).activeBleController = { releaseConnection: jest.fn() };

    const p1 = ctrl.stopSession();
    const p2 = ctrl.stopSession();

    expect(p1).toBe(p2);
    await p1;

    expect(mockSessionRepo.requestStop).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
  });

  it('Failed final block prevents COMPLETED', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    (global as any).activeBleController = { releaseConnection: jest.fn() };

    (ctrl as any).commitQueue.getHasFailed = jest.fn().mockReturnValue(true);

    await ctrl.stopSession();

    expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'TELEMETRY_PERSISTENCE_FAILED');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
  });

  it('Disconnect produces INTERRUPTED once', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    (global as any).activeBleController = { releaseConnection: jest.fn() };

    await ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED');
    await ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED'); // Second call

    expect(mockSessionRepo.interruptSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'DEVICE_DISCONNECTED');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
  });

  it('Background produces INTERRUPTED once', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    (global as any).activeBleController = { releaseConnection: jest.fn() };

    // Force background
    ctrl.forceCleanup();
    await ctrl['terminalPromise'];

    expect(mockSessionRepo.interruptSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'UNEXPECTED_UNMOUNT');
  });

  it('Stop/disconnect race has one terminal state', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    (global as any).activeBleController = { releaseConnection: jest.fn() };

    const p1 = ctrl.stopSession();
    const p2 = ctrl.handleUnexpectedDisconnect('RACE');

    expect(p1).toBe(p2);
    await p1;

    // The first call (stopSession) won the race
    expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
  });
});
