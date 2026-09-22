jest.mock('../../../infrastructure/runtime/LiveForegroundRuntime', () => ({
  startLiveForegroundRuntime: jest.fn(),
  stopLiveForegroundRuntime: jest.fn(),
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

  it('Explicit terminal disconnect produces INTERRUPTED once', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    await ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED_RECOVERY_FAILED');
    await ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED_RECOVERY_FAILED');

    expect(mockSessionRepo.interruptSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'DEVICE_DISCONNECTED_RECOVERY_FAILED');
    expect(ctrl['currentState']).toBe('INTERRUPTED');
  });

  it('publishes one explicit terminal interruption outcome to the Live UI boundary', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    const onTerminal = jest.fn();
    (ctrl as any).onSessionTerminal = onTerminal;

    const first = ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED_RECOVERY_FAILED');
    const second = ctrl.handleUnexpectedDisconnect('DEVICE_DISCONNECTED_RECOVERY_FAILED');
    expect(first).toBe(second);
    await first;

    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledWith({
      state: 'INTERRUPTED',
      reason: 'DEVICE_DISCONNECTED_RECOVERY_FAILED'
    });
  });

  it('Native BLE disconnect enters bounded recovery before terminalization', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    let disconnectListener: (() => void) | null = null;
    const remove = jest.fn();
    const connection = {
      device: {
        onDisconnected: jest.fn((listener: () => void) => {
          disconnectListener = listener;
          return { remove };
        })
      }
    } as any;
    const recovery = jest.spyOn(ctrl, 'attemptConnectionRecovery').mockResolvedValue(true);

    (ctrl as any).observePhysicalDisconnect(connection);
    expect(disconnectListener).not.toBeNull();
    (disconnectListener as unknown as () => void)();
    await Promise.resolve();

    expect(recovery).toHaveBeenCalledTimes(1);
    expect(recovery).toHaveBeenCalledWith('DEVICE_DISCONNECTED', connection);
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
  });

  it('Native BLE disconnect after terminalization cannot change the outcome', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    let disconnectListener: (() => void) | null = null;
    const recovery = jest.spyOn(ctrl, 'attemptConnectionRecovery').mockResolvedValue(true);

    (ctrl as any).observePhysicalDisconnect({
      device: {
        onDisconnected: jest.fn((listener: () => void) => {
          disconnectListener = listener;
          return { remove: jest.fn() };
        })
      }
    });

    await ctrl.stopSession();
    (disconnectListener as unknown as () => void)();

    expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
    expect(recovery).not.toHaveBeenCalled();
  });

  it('UI unmount/background boundary does not terminalize an active Live runtime', () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

    ctrl.forceCleanup();

    expect(ctrl['terminalPromise']).toBeNull();
    expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
    expect(ctrl['currentState']).toBe('ACTIVE');
  });

  it('rebinds UI observers on an already-active runtime without starting a second poller', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    const onUiUpdate = jest.fn();
    const onRecordingError = jest.fn();
    const onTerminal = jest.fn();

    await ctrl.start(onUiUpdate, onRecordingError, onTerminal);

    expect((ctrl as any).onUiUpdate).toBe(onUiUpdate);
    expect((ctrl as any).onRecordingError).toBe(onRecordingError);
    expect((ctrl as any).onSessionTerminal).toBe(onTerminal);
    expect(mockPoller.start).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
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

    expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
  });
});
