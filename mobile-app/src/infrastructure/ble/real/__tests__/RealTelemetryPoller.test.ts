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
    jest.restoreAllMocks();
  });

  const result = (status: CommandResult['status']) => ({
    status,
    request: {} as any,
    rawResponse: {} as any,
  } as any);

  const advanceOne = async (ms = 15) => {
    await Promise.resolve();
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  };

  it('retires a PID after 3 truly consecutive NO_DATA', async () => {
    mockExecutor.executeCommand.mockResolvedValue(result('NO_DATA'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);
    poller.start(10);

    await advanceOne();
    await advanceOne();
    await Promise.resolve();

    expect(onData).toHaveBeenCalledTimes(3);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ type: 'PID_RETIRED_NO_DATA', pid: '010C' }));
    expect(onDiagnostic).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(3);
  });

  it('normalizes discovered Tier-1 requests, deduplicates and rejects unknown requests', async () => {
    mockExecutor.executeCommand.mockResolvedValue(result('SUCCESS_DECODED'));

    const poller = new RealTelemetryPoller(
      mockExecutor,
      ['FFFF', ' 0104 ', '0104'],
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

  it('accepts request ids containing lowercase hex characters after normalization', async () => {
    mockExecutor.executeCommand.mockResolvedValue(result('SUCCESS_DECODED'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010b'], onData, onDiagnostic);
    poller.start(10);
    await Promise.resolve();
    poller.stop();

    expect(mockExecutor.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ command: '010B', expectedPid: '0B' })
    );
  });

  it('falls back to the driver-critical set instead of unrelated diagnostic signals', async () => {
    mockExecutor.executeCommand.mockResolvedValue(result('SUCCESS_DECODED'));

    const poller = new RealTelemetryPoller(mockExecutor, ['FFFF'], onData, onDiagnostic);
    poller.start(10);
    await Promise.resolve();
    poller.stop();

    expect(mockExecutor.executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ command: '0105', expectedPid: '05' })
    );
  });

  it('breaks the NO_DATA streak on any other typed result', async () => {
    mockExecutor.executeCommand
      .mockResolvedValue(result('SUCCESS_DECODED'))
      .mockResolvedValueOnce(result('NO_DATA'))
      .mockResolvedValueOnce(result('NO_DATA'))
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('NO_DATA'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 4; i++) await advanceOne();

    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PID_RETIRED_NO_DATA' }));
    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(5);
    poller.stop();
  });

  it('emits one TRANSPORT_STALLED after three consecutive transport failures', async () => {
    mockExecutor.executeCommand.mockResolvedValue(result('TIMEOUT'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C', '010D'], onData, onDiagnostic);
    poller.start(10);

    await advanceOne();
    await advanceOne();
    await Promise.resolve();

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'TIMEOUT',
      consecutiveFailures: 3,
    }));
    poller.stop();
  });

  it('does not accumulate hard transport failures across typed pipeline replies', async () => {
    mockExecutor.executeCommand
      .mockResolvedValue(result('SUCCESS_DECODED'))
      .mockResolvedValueOnce(result('TIMEOUT'))
      .mockResolvedValueOnce(result('TIMEOUT'))
      .mockResolvedValueOnce(result('INVALID_RESPONSE'))
      .mockResolvedValueOnce(result('TIMEOUT'))
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('TIMEOUT'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C', '010D'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 6; i++) await advanceOne();

    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'TIMEOUT',
    }));
    poller.stop();
  });

  it('enters bounded recovery after a sustained run of unusable ECU-path responses', async () => {
    mockExecutor.executeCommand.mockResolvedValue(result('INVALID_RESPONSE'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C', '010D'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 5; i++) await advanceOne();
    await Promise.resolve();

    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'UNUSABLE_RESPONSE',
      consecutiveFailures: 6,
    }));
    poller.stop();
  });

  it('resets degraded-response health only when the vehicle path produces usable evidence', async () => {
    mockExecutor.executeCommand
      .mockResolvedValue(result('INVALID_RESPONSE'))
      .mockResolvedValueOnce(result('INVALID_RESPONSE'))
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('PARTIAL'))
      .mockResolvedValueOnce(result('SUCCESS_DECODED'))
      .mockResolvedValueOnce(result('INVALID_RESPONSE'))
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('PARTIAL'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C', '010D'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 7; i++) await advanceOne();

    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'UNUSABLE_RESPONSE',
    }));
    poller.stop();
  });

  it('does not mistake an optional bad PID for a dead link when other PIDs keep succeeding', async () => {
    mockExecutor.executeCommand
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('SUCCESS_DECODED'))
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('SUCCESS_DECODED'))
      .mockResolvedValueOnce(result('ELM_ERROR'))
      .mockResolvedValueOnce(result('SUCCESS_DECODED'))
      .mockResolvedValue(result('SUCCESS_DECODED'));

    const poller = new RealTelemetryPoller(mockExecutor, ['0104', '010C'], onData, onDiagnostic);
    poller.start(10);

    for (let i = 0; i < 5; i++) await advanceOne();

    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'UNUSABLE_RESPONSE',
    }));
    poller.stop();
  });

  it('contains thrown executor errors and keeps polling until bounded recovery is requested', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockExecutor.executeCommand.mockRejectedValue(new Error('socket exploded'));

    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);
    poller.start(10);

    await advanceOne();
    await advanceOne();
    await Promise.resolve();

    expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(3);
    expect(onData).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'WRITE_FAILED',
      consecutiveFailures: 3,
    }));
    poller.stop();
  });

  it('surfaces an already-disconnected controller instead of silently stopping', async () => {
    mockExecutor.isConnected = false;
    const poller = new RealTelemetryPoller(mockExecutor, ['010C'], onData, onDiagnostic);

    poller.start(10);
    await Promise.resolve();

    expect(mockExecutor.executeCommand).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSPORT_STALLED',
      reason: 'DISCONNECTED',
    }));
  });
});
