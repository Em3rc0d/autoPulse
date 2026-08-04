import { AdapterCompatibilityProfile } from './AdapterCompatibilityProfile';

export const KNOWN_PROFILES: AdapterCompatibilityProfile[] = [
  {
    id: 'standard-elm327-ble',
    name: 'Standard ELM327 BLE',
    expectedServices: ['0000fff0-0000-1000-8000-00805f9b34fb', 'fff0'],
    expectedWriteCharacteristics: ['0000fff2-0000-1000-8000-00805f9b34fb', 'fff2'],
    expectedReceiveCharacteristics: ['0000fff1-0000-1000-8000-00805f9b34fb', 'fff1']
  },
  {
    id: 'standard-elm327-ble-alt',
    name: 'Standard ELM327 BLE (Alt)',
    expectedServices: ['0000ffe0-0000-1000-8000-00805f9b34fb', 'ffe0'],
    expectedWriteCharacteristics: ['0000ffe1-0000-1000-8000-00805f9b34fb', 'ffe1'],
    expectedReceiveCharacteristics: ['0000ffe1-0000-1000-8000-00805f9b34fb', 'ffe1']
  }
];

// Helper to normalize UUIDs for matching (lowercase, removes short-uuid ambiguities if needed)
export function normalizeUuid(uuid: string): string {
  let normalized = uuid.toLowerCase();
  // If it's a 4-character short UUID, we can expand it to standard 128-bit
  if (normalized.length === 4) {
    normalized = `0000${normalized}-0000-1000-8000-00805f9b34fb`;
  }
  return normalized;
}
