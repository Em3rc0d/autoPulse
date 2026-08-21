import { CharacteristicCandidateSelector } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';
import { GattInventory } from '../../../../src/infrastructure/ble/probe/GattInspector';

describe('CharacteristicCandidateSelector', () => {
  it('ranks the best same-service notify pair even when discovered after the first three characteristics', () => {
    const inventory: GattInventory = {
      deviceId: 'adapter-1',
      deviceName: 'Generic OBD',
      rssi: -55,
      mtu: 23,
      services: [
        {
          uuid: 'service-a',
          characteristics: [
            { uuid: 'w1', serviceUuid: 'service-a', isReadable: false, isWritableWithResponse: false, isWritableWithoutResponse: true, isNotifiable: false, isIndicatable: false },
            { uuid: 'w2', serviceUuid: 'service-a', isReadable: false, isWritableWithResponse: false, isWritableWithoutResponse: true, isNotifiable: false, isIndicatable: false },
            { uuid: 'r1', serviceUuid: 'service-a', isReadable: true, isWritableWithResponse: false, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
          ],
        },
        {
          uuid: 'service-best',
          characteristics: [
            { uuid: 'best-write', serviceUuid: 'service-best', isReadable: false, isWritableWithResponse: true, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
            { uuid: 'best-notify', serviceUuid: 'service-best', isReadable: false, isWritableWithResponse: false, isWritableWithoutResponse: false, isNotifiable: true, isIndicatable: false },
          ],
        },
      ],
    };

    const combinations = CharacteristicCandidateSelector.selectCombinations(inventory);

    expect(combinations[0].writeCharacteristic.uuid).toBe('best-write');
    expect(combinations[0].receiveCharacteristic.uuid).toBe('best-notify');
    expect(combinations[0].score).toBe(130);
  });

  it('is deterministic when two combinations have the same score', () => {
    const inventory: GattInventory = {
      deviceId: 'adapter-2',
      deviceName: 'Generic OBD',
      rssi: -50,
      mtu: 23,
      services: [
        {
          uuid: 'svc',
          characteristics: [
            { uuid: 'write-b', serviceUuid: 'svc', isReadable: false, isWritableWithResponse: true, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
            { uuid: 'write-a', serviceUuid: 'svc', isReadable: false, isWritableWithResponse: true, isWritableWithoutResponse: false, isNotifiable: false, isIndicatable: false },
            { uuid: 'notify', serviceUuid: 'svc', isReadable: false, isWritableWithResponse: false, isWritableWithoutResponse: false, isNotifiable: true, isIndicatable: false },
          ],
        },
      ],
    };

    const first = CharacteristicCandidateSelector.selectCombinations(inventory);
    const second = CharacteristicCandidateSelector.selectCombinations(inventory);

    expect(first).toEqual(second);
  });
});
