import { AdapterInitializationBehaviorProbe } from '../../../../src/infrastructure/ble/probe/AdapterInitializationBehaviorProbe';
import { ProbeHandshake } from '../../../../src/infrastructure/ble/probe/ProbeHandshake';

const combination = {
  writeCharacteristic: {
    uuid: 'write', serviceUuid: 'svc', isReadable: false,
    isWritableWithResponse: true, isWritableWithoutResponse: false,
    isNotifiable: false, isIndicatable: false,
  },
  receiveCharacteristic: {
    uuid: 'notify', serviceUuid: 'svc', isReadable: false,
    isWritableWithResponse: false, isWritableWithoutResponse: false,
    isNotifiable: true, isIndicatable: false,
  },
  score: 130,
};

const acknowledged = {
  writeAccepted: true,
  responseReceived: true,
  rawByteCount: 3,
  sanitizedResponse: 'OK',
  echoDetected: false,
  promptDetected: true,
  latencyMs: 50,
  timedOut: false,
  disconnectObserved: false,
};

describe('AdapterInitializationBehaviorProbe', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records acknowledged preferred formatting behavior without touching vehicle PIDs', async () => {
    const execute = jest.spyOn(ProbeHandshake, 'execute').mockResolvedValue(acknowledged as any);

    const result = await AdapterInitializationBehaviorProbe.execute(
      {} as any,
      combination as any,
      { cancelled: false },
    );

    expect(result.disconnectObserved).toBe(false);
    expect(result.checks.map(check => check.behavior)).toEqual([
      'ECHO_CONTROL',
      'LINEFEED_CONTROL',
      'SPACES_CONTROL',
      'HEADERS_CONTROL',
      'AUTO_PROTOCOL_SELECTION',
    ]);
    expect(result.checks.every(check => check.outcome === 'ACKNOWLEDGED')).toBe(true);
    expect(execute.mock.calls.map(call => call[2])).toEqual([
      'ATE0\r', 'ATL0\r', 'ATS0\r', 'ATH0\r', 'ATSP0\r',
    ]);
    expect(execute.mock.calls.some(call => /^01|^09|^03$/.test(call[2]))).toBe(false);
  });

  it('records a rejected preferred command without treating it as a transport failure', async () => {
    jest.spyOn(ProbeHandshake, 'execute')
      .mockResolvedValueOnce(acknowledged as any)
      .mockResolvedValueOnce(acknowledged as any)
      .mockResolvedValueOnce({ ...acknowledged, sanitizedResponse: '?' } as any)
      .mockResolvedValue(acknowledged as any);

    const result = await AdapterInitializationBehaviorProbe.execute(
      {} as any,
      combination as any,
      { cancelled: false },
    );

    expect(result.disconnectObserved).toBe(false);
    expect(result.checks.find(check => check.behavior === 'SPACES_CONTROL')?.outcome).toBe('REJECTED');
  });

  it('stops immediately when a disconnect is observed', async () => {
    const execute = jest.spyOn(ProbeHandshake, 'execute').mockResolvedValueOnce({
      ...acknowledged,
      sanitizedResponse: null,
      responseReceived: false,
      disconnectObserved: true,
    } as any);

    const result = await AdapterInitializationBehaviorProbe.execute(
      {} as any,
      combination as any,
      { cancelled: false },
    );

    expect(result.disconnectObserved).toBe(true);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].outcome).toBe('DISCONNECTED');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
