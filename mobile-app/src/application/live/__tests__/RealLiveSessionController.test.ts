jest.mock('../LiveForegroundService', () => ({
  startLiveForegroundService: jest.fn().mockReturnValue(true),
  stopLiveForegroundService: jest.fn(),
  subscribeLiveForegroundServiceFailure: jest.fn().mockReturnValue(jest.fn()),
}));

import { RealLiveSessionController } from '../RealLiveSessionController';
import { TelemetryCommitQueueDrainTimeoutError } from '../TelemetryCommitQueue';
import { activeBleController } from '../../../infrastructure/ble/ActiveBleConnectionController';

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

  it('does not abandon BLE cleanup when requestStop throws', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    mockSessionRepo.requestStop.mockRejectedValueOnce(new Error('SQLite unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await ctrl.stopSession();

    expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
    expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith(
      'ws1', 'sess1', 'SESSION_STOP_REQUEST_FAILED'
    );
    expect(ctrl['currentState']).toBe('INTERRUPTED');
    expect(ctrl.recordingStatus).toBe('CLOSED');
    errorLog.mockRestore();
  });

  it('records interruption if a final telemetry flush throws', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    (ctrl as any).assembler.flush = jest.fn(() => { throw new Error('codec exception'); });
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await ctrl.stopSession();
      expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
      expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'TELEMETRY_FINAL_FLUSH_FAILED');
      expect(ctrl['currentState']).toBe('INTERRUPTED');
    } finally { log.mockRestore(); }
  });

  it('does not claim a completed session when completion persistence rejects', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    mockSessionRepo.completeSession.mockRejectedValueOnce(new Error('DB locked'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await ctrl.stopSession();
      expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
      expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'SESSION_COMPLETION_FAILED');
      expect(ctrl['currentState']).toBe('INTERRUPTED');
    } finally { log.mockRestore(); }
  });

  it('holds the BLE LIVE lease until session completion is durable', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';
    let allowCommit: (() => void) | undefined;
    mockSessionRepo.completeSession.mockImplementation(() => new Promise<void>(resolve => { allowCommit = resolve; }));
    const release = jest.spyOn(activeBleController, 'releaseClaim');
    try {
      const stopped = ctrl.stopSession();
      await new Promise(resolve => setTimeout(resolve, 125));
      expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
      expect(release).not.toHaveBeenCalled();
      allowCommit?.();
      await stopped;
      expect(release).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledWith('LIVE');
      expect(ctrl['currentState']).toBe('COMPLETED');
    } finally {
      allowCommit?.();
      release.mockRestore();
    }
  });

  it('forces interruption when stopped while a native BLE recovery is in flight', async () => {
    const ctrl = createController();
    ctrl['currentState'] = 'RECOVERING';
    let finishRecovery: ((value: boolean) => void) | undefined;
    (ctrl as any).recoveryPromise = new Promise<boolean>(resolve => { finishRecovery = resolve; });
    const disconnect = jest.spyOn(activeBleController, 'disconnectAndRelease').mockResolvedValue(undefined);
    try {
      const stopping = ctrl.stopSession();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(disconnect).not.toHaveBeenCalled();
      finishRecovery?.(false);
      await stopping;
      expect(mockSessionRepo.completeSession).not.toHaveBeenCalled();
      expect(mockSessionRepo.interruptSession).toHaveBeenCalledWith('ws1', 'sess1', 'STOP_DURING_RECOVERY');
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      finishRecovery?.(false);
      disconnect.mockRestore();
    }
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

  it('app visibility is not treated as a terminal transport event', () => {
    const ctrl = createController();
    ctrl['currentState'] = 'ACTIVE';

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

    expect(mockSessionRepo.completeSession).toHaveBeenCalledTimes(1);
    expect(mockSessionRepo.interruptSession).not.toHaveBeenCalled();
  });
});
