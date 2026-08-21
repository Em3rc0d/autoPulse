import { AdapterCompatibilityGrade, ProbeVerdict } from '../../../../src/domain/telemetry/probe/ProbeResult';
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

  return { manager };
}

describe('BleCompatibilityProbe release grading', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps an exact known profile at COMPATIBLE and preserves the actual profile identity', async () => {
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
    expect(result.profileMatch).toBe('EXACT_PROFILE_MATCH');
    expect(result.matchedProfileId).toBe('standard-elm327-ble');
    expect(result.commandUsed).toBe('ATI\r');
    expect(result.connectionRetained).toBe(true);
  });

  it('grades a working generic adapter without a known profile as COMPATIBLE', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({
      matchType: 'NO_PROFILE_MATCH',
    });

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.SUPPORTED);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.COMPATIBLE);
    expect(result.profileMatch).toBe('NO_PROFILE_MATCH');
    expect(result.matchedProfileId).toBeUndefined();
    expect(result.commandUsed).toBe('ATI\r');
    expect(result.connectionRetained).toBe(true);
  });

  it('grades missing viable GATT channels as UNSUPPORTED', async () => {
    const { manager } = createHarness();
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({
      matchType: 'NO_PROFILE_MATCH',
    });
    (CharacteristicCandidateSelector.selectCombinations as jest.Mock).mockReturnValue([]);

    const probe = new BleCompatibilityProbe(manager, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.INCOMPATIBLE_TRANSPORT);
    expect(result.compatibilityGrade).toBe(AdapterCompatibilityGrade.UNSUPPORTED);
    expect(result.connectionRetained).toBe(false);
  });
});
