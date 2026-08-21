import { CharacteristicCandidateSelector } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';
import { GattInventory } from '../../../../src/infrastructure/ble/probe/GattInspector';

function char(overrides: any) {
  return {
    uuid: overrides.uuid,
    serviceUuid: overrides.serviceUuid,
    isReadable: false,
    isWritableWithResponse: false,
    isWritableWithoutResponse: false,
    isNotifiable: false,
    isIndicatable: false,
    ...overrides,
  };
}

describe('CharacteristicCandidateSelector', () => {
  it('ranks the best pair even when it appears after the first three candidates', () => {
    const inventory: GattInventory = {
      deviceId: 'adapter-1',
      deviceName: 'Generic OBD',
      rssi: -60,
      mtu: 23,
      services: [
        {
          uuid: 's1',
          characteristics: [
            char({ uuid: 'w1', serviceUuid: 's1', isWritableWithoutResponse: true }),
            char({ uuid: 'r1', serviceUuid: 's1', isReadable: true }),
          ],
        },
        {
          uuid: 's2',
          characteristics: [
            char({ uuid: 'w2', serviceUuid: 's2', isWritableWithoutResponse: true }),
            char({ uuid: 'r2', serviceUuid: 's2', isReadable: true }),
          ],
        },
        {
          uuid: 's3',
          characteristics: [
            char({ uuid: 'w3', serviceUuid: 's3', isWritableWithoutResponse: true }),
            char({ uuid: 'r3', serviceUuid: 's3', isReadable: true }),
          ],
        },
        {
          uuid: 's4',
          characteristics: [
            char({ uuid: 'best-write', serviceUuid: 's4', isWritableWithResponse: true }),
            char({ uuid: 'best-notify', serviceUuid: 's4', isNotifiable: true }),
          ],
        },
      ],
    };

    const result = CharacteristicCandidateSelector.selectCombinations(inventory);

    expect(result[0].writeCharacteristic.uuid).toBe('best-write');
    expect(result[0].receiveCharacteristic.uuid).toBe('best-notify');
    expect(result[0].score).toBe(130);
  });

  it('uses deterministic tie-breaking for equal scores', () => {
    const inventory: GattInventory = {
      deviceId: 'adapter-1',
      deviceName: 'Generic OBD',
      rssi: -60,
      mtu: 23,
      services: [
        {
          uuid: 'service-z',
          characteristics: [
            char({ uuid: 'write-z', serviceUuid: 'service-z', isWritableWithResponse: true }),
            char({ uuid: 'notify-z', serviceUuid: 'service-z', isNotifiable: true }),
          ],
        },
        {
          uuid: 'service-a',
          characteristics: [
            char({ uuid: 'write-a', serviceUuid: 'service-a', isWritableWithResponse: true }),
            char({ uuid: 'notify-a', serviceUuid: 'service-a', isNotifiable: true }),
          ],
        },
      ],
    };

    const result = CharacteristicCandidateSelector.selectCombinations(inventory);

    expect(result[0].writeCharacteristic.uuid).toBe('write-a');
    expect(result[0].receiveCharacteristic.uuid).toBe('notify-a');
  });
});
