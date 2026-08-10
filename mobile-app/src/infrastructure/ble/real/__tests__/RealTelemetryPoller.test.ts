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

  it('strictly obeys the resolved polling set for PERFORMANCE mode (Gate 2.6)', async () => {
    // PERFORMANCE mode resolves: ENGINE_RPM, ENGINE_LOAD, THROTTLE_POSITION, MAP
    // Which translate to: 010C, 0104, 0111, 010B
    const resolvedPollingSet = ['010C', '0104', '0111', '010B'];
    
    mockExecutor.executeCommand.mockResolvedValue({
      status: 'SUCCESS_DECODED',
      request: {} as any,
      rawResponse: {} as any
    } as any);

    const poller = new RealTelemetryPoller(mockExecutor, resolvedPollingSet, onData, onDiagnostic);
    poller.start(10);

    // start() executes the 1st command immediately. Run 3 more timer ticks for a full cycle of 4 commands.
    for (let i = 0; i < 3; i++) {
      await Promise.resolve();
      jest.runOnlyPendingTimers();
    }

    poller.stop();

    // Verify exactly 4 commands were executed
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(4);

    const executedCommands = mockExecutor.executeCommand.mock.calls.map(call => call[0].command);
    
    // Assert actual commands === expected commands
    expect(executedCommands).toEqual(['010C', '0104', '0111', '010B']);

    // Assert what was NOT requested
    expect(executedCommands).not.toContain('010D'); // Speed
    expect(executedCommands).not.toContain('0105'); // Coolant
    expect(executedCommands).not.toContain('ATRV'); // Adapter Voltage
  });
});
