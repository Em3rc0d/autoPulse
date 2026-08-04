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

    // 1st NO_DATA
    await Promise.resolve();
    expect(onData).toHaveBeenCalledWith(expect.objectContaining({ status: 'NO_DATA' }));
    jest.advanceTimersByTime(15);
    
    // 2nd NO_DATA
    await Promise.resolve();
    expect(onData).toHaveBeenCalledWith(expect.objectContaining({ status: 'NO_DATA' }));
    jest.advanceTimersByTime(15);

    // 3rd NO_DATA - should retire
    await Promise.resolve();
    expect(onData).toHaveBeenCalledTimes(3);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ type: 'PID_RETIRED_NO_DATA', pid: '010C' }));
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    
    // Poller should stop since it was the only PID
    jest.advanceTimersByTime(100);
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(3);
  });

  it('resets NO_DATA counter on SUCCESS_DECODED', async () => {
    mockExecutor.executeCommand
      .mockResolvedValue({ status: 'SUCCESS_DECODED', request: {} as any, rawResponse: {} as any } as any) // fallback
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'SUCCESS_DECODED', request: {} as any, rawResponse: {} as any } as any)
      .mockResolvedValueOnce({ status: 'NO_DATA', request: {} as any, rawResponse: {} as any } as any);

    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);
    poller.start(10);

    // Run 4 iterations
    for (let i = 0; i < 4; i++) {
      await Promise.resolve();
      jest.advanceTimersByTime(15);
    }

    // Should not have retired because of the success in the middle
    expect(onDiagnostic).not.toHaveBeenCalled();
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(5);
  });
});
