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

    // 1. Gather all candidates
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

    // 2. Build combinations
    for (const wc of writeCandidates) {
      for (const rc of receiveCandidates) {
        let score = 0;

        // Same service is highly preferred
        if (wc.serviceUuid === rc.serviceUuid) score += 100;

        // Write with response is slightly preferred
        if (wc.isWritableWithResponse) score += 10;
        else if (wc.isWritableWithoutResponse) score += 5;

        // Notify is highly preferred, then indicate, read is fallback
        if (rc.isNotifiable) score += 20;
        else if (rc.isIndicatable) score += 15;
        else if (rc.isReadable) score -= 50; // Read as fallback penalty

        combinations.push({
          writeCharacteristic: wc,
          receiveCharacteristic: rc,
          score
        });
      }
    }

    // Sort by score descending
    combinations.sort((a, b) => b.score - a.score);

    // Limit to max 12 combinations
    return combinations.slice(0, 12);
  }
}
