import { AdapterBehaviorAssessor } from '../../../../src/infrastructure/ble/probe/AdapterBehaviorAssessor';
import { ProbeHandshake } from '../../../../src/infrastructure/ble/probe/ProbeHandshake';
import { CandidateCombination } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';

const candidate: CandidateCombination = {
  writeCharacteristic: {
    uuid: 'write', serviceUuid: 'service', isReadable: false,
    isWritableWithResponse: true, isWritableWithoutResponse: false,
    isNotifiable: false, isIndicatable: false,
  },
  receiveCharacteristic: {
    uuid: 'notify', serviceUuid: 'service', isReadable: false,
    isWritableWithResponse: false, isWritableWithoutResponse: false,
    isNotifiable: true, isIndicatable: false,
  },
  score: 130,
};

const ok = {
  writeAccepted: true,
  responseReceived: true,
  rawByteCount: 3,
  sanitizedResponse: 'OK',
  echoDetected: false,
  promptDetected: true,
  latencyMs: 20,
  timedOut: false,
  disconnectObserved: false,
};

describe('AdapterBehaviorAssessor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('marks complete successful behavior as certification-ready evidence without certifying', async () => {
    jest.spyOn(ProbeHandshake, 'execute').mockResolvedValue(ok);

    const result = await AdapterBehaviorAssessor.assess({} as any, candidate, { cancelled: false });

    expect(result.checks).toHaveLength(7);
    expect(result.preferredFailures).toEqual([]);
    expect(result.optionalFailures).toEqual([]);
    expect(result.disconnectObserved).toBe(false);
    expect(result.certificationReady).toBe(true);
  });

  it('records a preferred command failure', async () => {
    jest.spyOn(ProbeHandshake, 'execute')
      .mockResolvedValueOnce({ ...ok, sanitizedResponse: '?' })
      .mockResolvedValue(ok);

    const result = await AdapterBehaviorAssessor.assess({} as any, candidate, { cancelled: false });

    expect(result.preferredFailures).toContain('ATE0');
    expect(result.certificationReady).toBe(false);
  });

  it('records an optional failure without turning it into a preferred failure', async () => {
    jest.spyOn(ProbeHandshake, 'execute')
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ ...ok, sanitizedResponse: '?' })
      .mockResolvedValue(ok);

    const result = await AdapterBehaviorAssessor.assess({} as any, candidate, { cancelled: false });

    expect(result.preferredFailures).toEqual([]);
    expect(result.optionalFailures).toContain('ATS0');
    expect(result.certificationReady).toBe(false);
  });

  it('stops assessment when the adapter disconnects', async () => {
    jest.spyOn(ProbeHandshake, 'execute').mockResolvedValue({
      ...ok,
      responseReceived: false,
      sanitizedResponse: null,
      promptDetected: false,
      disconnectObserved: true,
    });

    const result = await AdapterBehaviorAssessor.assess({} as any, candidate, { cancelled: false });

    expect(result.disconnectObserved).toBe(true);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].outcome).toBe('DISCONNECTED');
    expect(result.certificationReady).toBe(false);
  });
});
