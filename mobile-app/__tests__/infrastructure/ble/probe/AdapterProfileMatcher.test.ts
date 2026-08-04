import { AdapterProfileMatcher } from '../../../../src/infrastructure/ble/probe/AdapterProfileMatcher';
import { GattInventory } from '../../../../src/infrastructure/ble/probe/GattInspector';
import { KNOWN_PROFILES } from '../../../../src/infrastructure/ble/profiles/knownProfiles';

describe('AdapterProfileMatcher', () => {
  it('should return EXACT_PROFILE_MATCH if all services and chars match', () => {
    const profile = KNOWN_PROFILES[0]; // Standard ELM327 BLE
    const inventory: GattInventory = {
      deviceId: '1',
      deviceName: 'OBDII',
      rssi: -50,
      mtu: 20,
      services: [
        {
          uuid: profile.expectedServices[0],
          characteristics: [
            { uuid: profile.expectedWriteCharacteristics[0], serviceUuid: profile.expectedServices[0], isReadable: false, isWritableWithResponse: true, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
            { uuid: profile.expectedReceiveCharacteristics[0], serviceUuid: profile.expectedServices[0], isReadable: false, isWritableWithResponse: false, isWritableWithoutResponse: false, isNotifiable: true, isIndicatable: false }
          ]
        }
      ]
    };

    const result = AdapterProfileMatcher.match(inventory);
    expect(result.matchType).toBe('EXACT_PROFILE_MATCH');
    expect(result.profile?.id).toBe(profile.id);
  });

  it('should return PARTIAL_PROFILE_MATCH if only service matches', () => {
    const profile = KNOWN_PROFILES[0];
    const inventory: GattInventory = {
      deviceId: '1',
      deviceName: 'OBDII',
      rssi: -50,
      mtu: 20,
      services: [
        {
          uuid: profile.expectedServices[0],
          characteristics: [
            { uuid: 'some-other-uuid', serviceUuid: profile.expectedServices[0], isReadable: false, isWritableWithResponse: true, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
          ]
        }
      ]
    };

    const result = AdapterProfileMatcher.match(inventory);
    expect(result.matchType).toBe('PARTIAL_PROFILE_MATCH');
  });

  it('should return NO_PROFILE_MATCH if nothing matches', () => {
    const inventory: GattInventory = {
      deviceId: '1',
      deviceName: 'OBDII',
      rssi: -50,
      mtu: 20,
      services: [
        {
          uuid: 'random-service',
          characteristics: [
            { uuid: 'random-char', serviceUuid: 'random-service', isReadable: false, isWritableWithResponse: true, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
          ]
        }
      ]
    };

    const result = AdapterProfileMatcher.match(inventory);
    expect(result.matchType).toBe('NO_PROFILE_MATCH');
    expect(result.profile).toBeUndefined();
  });
});
