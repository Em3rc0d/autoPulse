import { RealTelemetryPoller } from '../RealTelemetryPoller';
import { CommandRequest, CommandResult } from '../pipeline/types';

describe('RealTelemetryPoller', () => {
  let mockExecutor: {
    isConnected: boolean;
    executeCommand: jest.Mock<Promise<CommandResult>, [CommandRequest]>;
  };
  let onData: jest.Mock;
  let onDiagnostic: jest.Mock;

  beforeEach(() => {
    mockExecutor = {
      isConnected: true,
      executeCommand: jest.fn()
    };
    onData = jest.fn();
    onDiagnostic = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retires a PID after 3 consecutive NO_DATA', async () => {
    mockExecutor.executeCommand.mockResolvedValue({
      status: 'NO_DATA',
      request: {} as any,
      rawResponse: {} as any
    } as any);

    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);
    poller.start(10);

    await Promise.resolve();
    jest.advanceTimersByTime(15);
    await Promise.resolve();
    jest.advanceTimersByTime(15);
    await Promise.resolve();

    expect(onData).toHaveBeenCalledTimes(3);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ type: 'PID_RETIRED_NO_DATA', pid: '010C' }));
    expect(onDiagnostic).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(3);
  });

  it('polls any discovered Tier-1 catalog PID and rejects unknown requests', async () => {
    mockExecutor.executeCommand.mockResolvedValue({
      status: 'SUCCESS_DECODED',
      request: {} as any,
      rawResponse: {} as any
    } as any);

    const poller = new RealTelemetryPoller(
      mockExecutor,
      ['FFFF', '0104', '0104'],
      onData,
      onDiagnostic
    );
    poller.start(10);
    await Promise.resolve();
    poller.stop();

    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(1);
    expect(mockExecutor.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: '0104',
        family: 'OBD_MODE_01',
        expectedService: '41',
        expectedPid: '04'
      })
    );
  });

  it('resets NO_DATA counter on SUCCESS_DECODED', async () => {
    mockExecutor.executeCommand
      .mockResolvedValue({ status: 'SUCCESS_DECODED', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'SUCCESS_DECODED', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any);

    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 4; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(15);
    }

    expect(onDiagnostic).not.toHaveBeenCalled();
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(5);
  });

  it('emits one TRANSPORT_STALLED after three consecutive transport failures', async () => {
    mockExecutor.executeCommand.mockResolvedValue({
      status: 'TIMEOUT',
      request: {} as any,
      rawResponse: {} as any
    } as any);

    const poller = new RealTelemetryPoller(mockExecutor, ['010C', '010D'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 3; i++) {
      await Promise.resolve();
      if (i < 2) jest.advanceTimersByTime(15);
    }

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'TIMEOUT',
      consecutiveFailures: 3,
    }));
  });

  it('does not treat NO_DATA or ELM_ERROR as a transport stall', async () => {
    mockExecutor.executeCommand
      .mockResolvedValue({ status: 'SUCCESS_DECODED', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'TIMEOUT', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'TIMEOUT', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'TIMEOUT', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'ELM_ERROR', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'TIMEOUT', request: {} as any, rawResponse: {} as any } as any);

    const poller = new RealTelemetryPoller(mockExecutor, ['010C', '010D'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      if (i < 5) jest.advanceTimersByTime(15);
    }

    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'TRANSPORT_STALLED' }));
  });
});
