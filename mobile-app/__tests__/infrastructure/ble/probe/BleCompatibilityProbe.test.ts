import { BleCompatibilityProbe } from '../../../../src/infrastructure/ble/probe/BleCompatibilityProbe';
import { GattInspector } from '../../../../src/infrastructure/ble/probe/GattInspector';
import { AdapterProfileMatcher } from '../../../../src/infrastructure/ble/probe/AdapterProfileMatcher';
import { CharacteristicCandidateSelector } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';
import { ProbeHandshake } from '../../../../src/infrastructure/ble/probe/ProbeHandshake';
import { ProbeVerdict } from '../../../../src/domain/telemetry/probe/ProbeResult';

const combination = {
  writeCharacteristic: {
    uuid: 'write',
    serviceUuid: 'svc',
    isReadable: false,
    isWritableWithResponse: true,
    isWritableWithoutResponse: false,
    isNotifiable: false,
    isIndicatable: false,
  },
  receiveCharacteristic: {
    uuid: 'notify',
    serviceUuid: 'svc',
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
  rssi: -50,
  mtu: 23,
  services: [],
};

const goodHandshake = {
  writeAccepted: true,
  responseReceived: true,
  rawByteCount: 12,
  sanitizedResponse: 'ELM327 v1.5',
  echoDetected: false,
  promptDetected: true,
  latencyMs: 120,
  timedOut: false,
  disconnectObserved: false,
};

describe('BleCompatibilityProbe R4 grading', () => {
  const device = {
    id: 'adapter-1',
    name: 'OBDII',
    localName: 'OBDII',
    rssi: -50,
    discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
    cancelConnection: jest.fn().mockResolvedValue(undefined),
  };
  const manager = {
    connectToDevice: jest.fn().mockResolvedValue(device),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(GattInspector, 'inspect').mockResolvedValue(inventory as any);
    jest.spyOn(CharacteristicCandidateSelector, 'selectCombinations').mockReturnValue([combination as any]);
    jest.spyOn(ProbeHandshake, 'execute').mockResolvedValue(goodHandshake as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('certifies a known exact profile only after successful behavior', async () => {
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({
      matchType: 'EXACT_PROFILE_MATCH',
      profile: { id: 'known' },
    } as any);

    const probe = new BleCompatibilityProbe(manager as any, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.SUPPORTED_WITH_PROFILE);
    expect(result.compatibilityGrade).toBe('CERTIFIED');
    expect(result.compatibilityReasons).toEqual(['EXACT_PROFILE_AND_BEHAVIOR_VERIFIED']);
    expect(result.connectionRetained).toBe(true);
  });

  it('grades an unknown generic profile as compatible when behavior succeeds', async () => {
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({
      matchType: 'NO_PROFILE_MATCH',
    } as any);

    const probe = new BleCompatibilityProbe(manager as any, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.verdict).toBe(ProbeVerdict.SUPPORTED);
    expect(result.compatibilityGrade).toBe('COMPATIBLE');
    expect(result.compatibilityReasons).toEqual(['GENERIC_BEHAVIOR_VERIFIED']);
  });

  it('degrades a valid adapter when the ELM prompt is not observed', async () => {
    jest.spyOn(AdapterProfileMatcher, 'match').mockReturnValue({
      matchType: 'EXACT_PROFILE_MATCH',
      profile: { id: 'known' },
    } as any);
    jest.spyOn(ProbeHandshake, 'execute').mockResolvedValue({
      ...goodHandshake,
      promptDetected: false,
      timedOut: true,
    } as any);

    const probe = new BleCompatibilityProbe(manager as any, 'adapter-1', jest.fn());
    const { result } = await probe.run();

    expect(result.compatibilityGrade).toBe('DEGRADED');
    expect(result.compatibilityReasons).toEqual(['RESPONSE_TIMEOUT', 'PROMPT_NOT_OBSERVED']);
  });
});
