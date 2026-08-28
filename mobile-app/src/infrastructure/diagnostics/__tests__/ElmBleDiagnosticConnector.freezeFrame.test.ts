import { ElmBleDiagnosticConnector } from '../ElmBleDiagnosticConnector';

function resultForFrame(payloadBytes: number[]) {
  return {
    status: 'SUCCESS_RAW',
    request: {},
    rawResponse: {
      accumulatedText: '4202000123\r>',
      fragments: [],
      completionReason: 'PROMPT_RECEIVED',
      startedAt: 1,
      finishedAt: 2,
      latencyMs: 1,
    },
    normalizedResponse: null,
    classifiedLines: [],
    obdFrames: [{
      sourceAddress: '7E8',
      service: '42',
      pid: '02',
      payloadBytes,
      declaredLength: null,
      rawLine: '4202000123',
      validity: 'VALID',
    }],
    negativeResponses: [],
    decodedValues: [],
    errors: [],
    latencyMs: 1,
  } as any;
}

describe('ElmBleDiagnosticConnector freeze-frame trigger', () => {
  it('exposes Mode 02 PID 02 frame number and trigger DTC without claiming full freeze-frame capture', async () => {
    const controller = {
      isConnected: true,
      executeCommand: jest.fn().mockResolvedValue(resultForFrame([0x00, 0x01, 0x23])),
      disconnect: jest.fn(),
    } as any;
    const connector = new ElmBleDiagnosticConnector(controller);

    const response = await connector.execute({
      id: 'ff-1',
      payload: '020200',
      kind: 'OBD_STANDARD',
      expectedService: '42',
      expectedPid: '02',
      timeoutMs: 5000,
    });

    expect(response.freezeFrameTrigger).toEqual({
      frameNumber: 0,
      triggerDtc: 'P0123',
      sourceEcu: '7E8',
    });
  });

  it('does not invent a trigger DTC for a zero pair', async () => {
    const controller = {
      isConnected: true,
      executeCommand: jest.fn().mockResolvedValue(resultForFrame([0x00, 0x00, 0x00])),
      disconnect: jest.fn(),
    } as any;
    const connector = new ElmBleDiagnosticConnector(controller);

    const response = await connector.execute({
      id: 'ff-2',
      payload: '020200',
      kind: 'OBD_STANDARD',
      expectedService: '42',
      expectedPid: '02',
      timeoutMs: 5000,
    });

    expect(response.freezeFrameTrigger).toEqual({
      frameNumber: 0,
      triggerDtc: undefined,
      sourceEcu: '7E8',
    });
  });
});
