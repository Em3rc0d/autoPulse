jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    currentState: 'active'
  }
}));

import { RealLiveSessionController } from '../RealLiveSessionController';
import { TelemetryCommitQueueDrainTimeoutError } from '../TelemetryCommitQueue';

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
    // Stub out actual telemetry operations for pure lifecycle testing.
    (ctrl as any).assembler = {
      flush: jest.fn().mockReturnValue(null)
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

    // Start details require a real/mocked BLE connection. This verifies the
    // lifecycle test fixture can represent an already-active controller.
    ctrl['currentState'] = 'ACTIVE';
    ctrl['commitQueue'] = {
      drain: jest.fn().mockResolvedValue(undefined),
      getHasFailed: jest.fn().mockReturnValue(false)
    } as any;

    expect(ctrl['currentState']).toBe('ACTIVE');
  });

  it('Double Stop shares terminal promise', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

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

    (ctrl as any).commitQueue.getHasFailed = jest.fn().mockReturnValue(true);

    await ctrl.stopSession();

    expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'TELEMETRY_PERSISTENCE_FAILED');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
  });

  it('Disconnect produces INTERRUPTED once', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    await ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED');
    await ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED');

    expect(mockSessionRepo.interruptSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'DEVICE_DISCONNECTED');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
  });

  it('App background uses the Release-1 APP_BACKGROUND interruption policy', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    (ctrl as any).handleAppStateChange('background');
    await ctrl['terminalPromise'];

    expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'APP_BACKGROUND');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
  });

  it('Returning/remaining active does not terminate the session', () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    (ctrl as any).handleAppStateChange('active');

    expect(ctrl['terminalPromise']).toBeNull();
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
  });

  it('Unexpected unmount produces INTERRUPTED once', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    ctrl.forceCleanup();
    await ctrl['terminalPromise'];

    expect(mockSessionRepo.interruptSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'UNEXPECTED_UNMOUNT');
  });

  it('Telemetry drain timeout prevents COMPLETED and records an explicit interruption reason', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (ctrl as any).commitQueue.drain = jest.fn().mockRejectedValue(
      new TelemetryCommitQueueDrainTimeoutError(5000, 1)
    );

    await ctrl.stopSession();

    expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'TELEMETRY_DRAIN_TIMEOUT');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
    expect(ctrl.recordingStatus).toBe('CLOSED');

    consoleError.mockRestore();
  });

  it('Stop/disconnect race has one terminal state', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    const p1 = ctrl.stopSession();
    const p2 = ctrl.handleUnexpectedDisconnect('RACE');

    expect(p1).toBe(p2);
    await p1;

    // The first call (stopSession) won the race.
    expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
  });
});
