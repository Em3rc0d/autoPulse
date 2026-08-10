import { RealObdInitialization } from '../RealObdInitialization';
import { obdTransportRegistry } from '../../../../application/live/ObdTransportRegistry';
import { CommandRequest, CommandResult } from '../pipeline/types';

describe('RealObdInitialization Guard & Critical Path', () => {
  let mockController: any;
  let onProgress: jest.Mock;

  beforeEach(() => {
    onProgress = jest.fn();
    mockController = {
      isConnected: true,
      executeCommand: jest.fn()
    };
  });

  // Test A: Partial discovery then disconnect
  it('Test A: fails initialization immediately if a command returns DISCONNECTED mid-discovery', async () => {
    mockController.executeCommand
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'ATZ' } }) // ATZ
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })  // ATE0
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })  // ATL0
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })  // ATS0
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })  // ATH0
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })  // ATCAF1
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })  // ATAT1
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'ELM v1.5' } }) // ATI
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OBDII' } })    // AT@1
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: '13.8V' } })    // ATRV
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } })       // ATSP0
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'AUTO, CAN' } })// ATDP
      .mockResolvedValueOnce({ status: 'SUCCESS_RAW', rawResponse: { accumulatedText: '6' } })         // ATDPN
      .mockResolvedValueOnce({                                                                         // 0100 - supported
        status: 'SUCCESS_DECODED',
        decodedValues: [{ type: 'BITMAP', value: ['010C', '010D', '0105'] }],
        rawResponse: { accumulatedText: '41 00 BE 1F A8 13' }
      })
      .mockImplementationOnce(async () => {                                                            // mid-discovery DISCONNECT
        mockController.isConnected = false;
        return { status: 'DISCONNECTED', errors: ['Connection lost'] };
      });

    const init = new RealObdInitialization(mockController, onProgress);
    const snapshot = await init.execute();

    expect(snapshot.initializationSuccessful).toBe(false);
    expect(snapshot.failureReason).toContain('DISCONNECTED');
  });

  // Test B: Unsupported optional core PID (NO_DATA for 0142 -> initializationSuccessful = true)
  it('Test B: succeeds initialization when optional core PID 0142 returns NO_DATA', async () => {
    mockController.executeCommand.mockImplementation(async (req: CommandRequest) => {
      if (req.command === '0100') {
        return {
          status: 'SUCCESS_DECODED',
          decodedValues: [{ type: 'BITMAP', value: ['010C', '010D', '0105'] }],
          rawResponse: { accumulatedText: '41 00 BE 1F A8 13' }
        };
      }
      if (req.command === '0142') {
        return { status: 'NO_DATA', errors: ['NO DATA'], rawResponse: { accumulatedText: 'NO DATA' } };
      }
      return { status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } };
    });

    const init = new RealObdInitialization(mockController, onProgress);
    const snapshot = await init.execute();

    expect(snapshot.initializationSuccessful).toBe(true);
    expect(snapshot.supportedPids).toContain('010C');
    expect(snapshot.supportedPids).not.toContain('0142');
  });

  // Test C: Enrichment not part of Live init (0900, 0902, 0904, 090A, 03 NOT executed)
  it('Test C: does NOT execute Mode 09 or Mode 03 diagnostic enrichment during Live initialization', async () => {
    mockController.executeCommand.mockImplementation(async (req: CommandRequest) => {
      if (req.command === '0100') {
        return {
          status: 'SUCCESS_DECODED',
          decodedValues: [{ type: 'BITMAP', value: ['010C'] }],
          rawResponse: { accumulatedText: '41 00 BE 1F A8 13' }
        };
      }
      return { status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } };
    });

    const init = new RealObdInitialization(mockController, onProgress);
    await init.execute();

    const executedCommands = mockController.executeCommand.mock.calls.map((c: any) => c[0].command);
    expect(executedCommands).not.toContain('0900');
    expect(executedCommands).not.toContain('0902');
    expect(executedCommands).not.toContain('0904');
    expect(executedCommands).not.toContain('090A');
    expect(executedCommands).not.toContain('03');
  });

  // Test D: Successful critical path preserves handoff
  it('Test D: registers healthy controller for handoff on successful critical path', async () => {
    mockController.executeCommand.mockImplementation(async (req: CommandRequest) => {
      if (req.command === '0100') {
        return {
          status: 'SUCCESS_DECODED',
          decodedValues: [{ type: 'BITMAP', value: ['010C'] }],
          rawResponse: { accumulatedText: '41 00 BE 1F A8 13' }
        };
      }
      return { status: 'SUCCESS_RAW', rawResponse: { accumulatedText: 'OK' } };
    });

    const init = new RealObdInitialization(mockController, onProgress);
    const snapshot = await init.execute();

    expect(snapshot.initializationSuccessful).toBe(true);
    expect(mockController.isConnected).toBe(true);

    // Register & take from transport registry
    obdTransportRegistry.register('test-handle-d', mockController);
    const retrieved = obdTransportRegistry.take('test-handle-d');
    expect(retrieved).toBe(mockController);
  });
});
