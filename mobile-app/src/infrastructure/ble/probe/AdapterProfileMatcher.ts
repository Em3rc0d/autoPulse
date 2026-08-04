import { AdapterCompatibilityProfile } from '../profiles/AdapterCompatibilityProfile';
import { KNOWN_PROFILES, normalizeUuid } from '../profiles/knownProfiles';
import { GattInventory } from './GattInspector';
import { ProfileMatchType } from '../../../domain/telemetry/probe/ProbeResult';

export class AdapterProfileMatcher {
  static match(inventory: GattInventory): { matchType: ProfileMatchType, profile?: AdapterCompatibilityProfile } {
    const allServiceUuids = inventory.services.map(s => normalizeUuid(s.uuid));
    const allCharUuids = inventory.services.flatMap(s => s.characteristics.map(c => normalizeUuid(c.uuid)));

    let bestMatch: AdapterCompatibilityProfile | undefined;
    let matchType: ProfileMatchType = 'NO_PROFILE_MATCH';

    for (const profile of KNOWN_PROFILES) {
      const expectedServicesNorm = profile.expectedServices.map(normalizeUuid);
      const expectedWriteNorm = profile.expectedWriteCharacteristics.map(normalizeUuid);
      const expectedReceiveNorm = profile.expectedReceiveCharacteristics.map(normalizeUuid);

      const hasService = expectedServicesNorm.some(u => allServiceUuids.includes(u));
      const hasWrite = expectedWriteNorm.some(u => allCharUuids.includes(u));
      const hasReceive = expectedReceiveNorm.some(u => allCharUuids.includes(u));

      if (hasService && hasWrite && hasReceive) {
        return { matchType: 'EXACT_PROFILE_MATCH', profile };
      }

      if (hasService || hasWrite || hasReceive) {
        matchType = 'PARTIAL_PROFILE_MATCH';
        bestMatch = profile;
      }
    }

    return { matchType, profile: bestMatch };
  }
}
