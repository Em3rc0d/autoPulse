import { AdapterCompatibilityGrade, ProbeVerdict } from '../../../../src/domain/telemetry/probe/ProbeResult';
import { AdapterBehaviorAssessor } from '../../../../src/infrastructure/ble/probe/AdapterBehaviorAssessor';
import { BleCompatibilityProbe } from '../../../../src/infrastructure/ble/probe/BleCompatibilityProbe';
import { GattInspector } from '../../../../src/infrastructure/ble/probe/GattInspector';
import { AdapterProfileMatcher } from '../../../../src/infrastructure/ble/probe/AdapterProfileMatcher';
import { CharacteristicCandidateSelector, CandidateCombination } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';
import { ProbeHandshake } from '../../../../src/infrastructure/ble/probe/ProbeHandshake';

const candidate: CandidateCombination = {
  writeCharacteristic: {
    uuid: 'write-char',
    serviceUuid: 'service-1',
    isReadable: false,
    isWritableWithResponse: true,
    isWritableWithoutResponse: false,
    isNotifiable: false,
    isIndicatable: false,
  },
  receiveCharacteristic: {
    uuid: 'notify-char',
    serviceUuid: 'service-1',
    isReadable: false,
    isWritableWithResponse: false,
    isWritableWithoutResponse: false,
    isNotifiable: true,
    isIndicatable: false,
  },
  score: 130,
};

const inventory = {
  deviceId: 'adapter-1',
  deviceName: 'OBDII',
  rssi: -55,
  mtu: 23,
  services: [],
};

const handshake = {
  writeAccepted: true,
  responseReceived: true,
  rawByteCount: 12,
  sanitizedResponse: 'ELM327 v1.5',
  echoDetected: true,
  promptDetected: true,
  latencyMs: 45,
  timedOut: false,
  disconnectObserved: false,
};

const compatibleAssessment = {
  schemaVersion: '1.0' as const,
  checks: [],
  preferredFailures: [],
  optionalFailures: [],
  disconnectObserved: false,
  certificationReady: true,
};

function createHarness() {
  const fakeDevice = {
    id: 'adapter-1',
    name: 'OBDII',
    localName: 'OBDII',
    rssi: -55,
    discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
    cancelConnection: jest.fn().mockResolvedValue(undefined),
  } as any;

  const manager = {
    connectToDevice: jest.fn().mockResolvedValue(fakeDevice),
  } as any;

  jest.spyOn(GattInspector, 'inspect').mockResolvedValue(inventory as any);
  jest.spyOn(CharacteristicCandidateSelector, 'selectCombinations').mockReturnValue([candidate]);
  jest.spyOn(ProbeHandshake, 'execute').mockResolvedValue(handshake);
  jest.spyOn(AdapterBehaviorAssessor, 'assess').mockResolvedValue(compatibleAssessment);

  return { manager };
}

describe('BleCompatibilityProbe release grading', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps perfect software evidence at COMPATIBLE and never self-certifies', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({
      matchType: 'EXACT_PROFILE_MATCH',
      profile: {
        id: 'standard-elm327-ble',
        name: 'Standard ELM327 BLE',
        expectedServices: [],
        expectedWriteCharacteristics: [],
        expectedReceiveCharacteristics: [],
      },
    });

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.SUPPORTED_WITH_PROFILE);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.COMPATIBLE);
    expect(result.behaviorAssessment?.certificationReady).toBe(true);
    expect(result.compatibilityGrade).not.toBe(AdapterCompatibilityGrade.CERTIFIED);
    expect(result.matchedProfileId).toBe('standard-elm327-ble');
  });

  it('grades a generic adapter with successful preferred behavior as COMPATIBLE', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({ matchType: 'NO_PROFILE_MATCH' });

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.SUPPORTED);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.COMPATIBLE);
    expect(result.matchedProfileId).toBeUndefined();
    expect(result.commandUsed).toBe('ATI\r');
  });

  it('grades a working adapter with preferred behavior failures as DEGRADED', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({ matchType: 'NO_PROFILE_MATCH' });
    (AdapterBehaviorAssessor.assess as jest.Mock).mockResolvedValue({
      ...compatibleAssessment,
      preferredFailures: ['ATE0'],
      certificationReady: false,
    });

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.SUPPORTED);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.DEGRADED);
    expect(result.connectionRetained).toBe(true);
  });

  it('keeps optional-only behavior failures COMPATIBLE', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({ matchType: 'NO_PROFILE_MATCH' });
    (AdapterBehaviorAssessor.assess as jest.Mock).mockResolvedValue({
      ...compatibleAssessment,
      optionalFailures: ['ATS0'],
      certificationReady: false,
    });

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.COMPATIBLE);
    expect(result.behaviorAssessment?.optionalFailures).toEqual(['ATS0']);
  });

  it('grades behavior-stage disconnect as UNSUPPORTED and does not retain connection', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({ matchType: 'NO_PROFILE_MATCH' });
    (AdapterBehaviorAssessor.assess as jest.Mock).mockResolvedValue({
      ...compatibleAssessment,
      disconnectObserved: true,
      certificationReady: false,
    });

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.PROBE_FAILED);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.UNSUPPORTED);
    expect(result.connectionRetained).toBe(false);
  });

  it('grades missing viable GATT channels as UNSUPPORTED', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({ matchType: 'NO_PROFILE_MATCH' });
    (CharacteristicCandidateSelector.selectCombinations as jest.Mock).mockReturnValue([]);

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.INCOMPATIBLE_TRANSPORT);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.UNSUPPORTED);
    expect(result.connectionRetained).toBe(false);
  });
});
