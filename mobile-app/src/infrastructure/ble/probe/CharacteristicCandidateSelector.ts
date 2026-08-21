import { GattInventory, DiscoveredCharacteristic } from './GattInspector';

export interface CandidateCombination {
  writeCharacteristic: DiscoveredCharacteristic;
  receiveCharacteristic: DiscoveredCharacteristic;
  score: number;
}

export class CharacteristicCandidateSelector {
  static selectCombinations(inventory: GattInventory): CandidateCombination[] {
    const writeCandidates: DiscoveredCharacteristic[] = [];
    const receiveCandidates: DiscoveredCharacteristic[] = [];

    for (const service of inventory.services) {
      for (const char of service.characteristics) {
        if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
          writeCandidates.push(char);
        }
        if (char.isNotifiable || char.isIndicatable || char.isReadable) {
          receiveCandidates.push(char);
        }
      }
    }

    const combinations: CandidateCombination[] = [];

    // Score the full viable inventory first. Discovery order must never decide
    // whether a valid adapter channel is even considered.
    for (const wc of writeCandidates) {
      for (const rc of receiveCandidates) {
        let score = 0;

        if (wc.serviceUuid === rc.serviceUuid) score += 100;

        if (wc.isWritableWithResponse) score += 10;
        else if (wc.isWritableWithoutResponse) score += 5;

        if (rc.isNotifiable) score += 20;
        else if (rc.isIndicatable) score += 15;
        else if (rc.isReadable) score -= 50;

        combinations.push({
          writeCharacteristic: wc,
          receiveCharacteristic: rc,
          score
        });
      }
    }

    combinations.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aKey = `${a.writeCharacteristic.serviceUuid}/${a.writeCharacteristic.uuid}/${a.receiveCharacteristic.uuid}`;
      const bKey = `${b.writeCharacteristic.serviceUuid}/${b.writeCharacteristic.uuid}/${b.receiveCharacteristic.uuid}`;
      return aKey.localeCompare(bKey);
    });

    // Bound probe cost only after deterministic ranking.
    return combinations.slice(0, 6);
  }
}
