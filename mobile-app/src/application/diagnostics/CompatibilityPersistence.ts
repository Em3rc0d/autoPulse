import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompatibilitySnapshot } from '../../domain/diagnostics';

const sessionKey = (sessionId: string) => `autopulse:compatibility:session:${sessionId}`;
const vehicleKey = (vehicleId: string) => `autopulse:compatibility:vehicle:${vehicleId}:latest`;

/**
 * Durable local evidence cache for completed compatibility characterizations.
 * The in-memory runtime store remains the fast Live bridge; this cache lets
 * Garage/Health and later sessions recover the latest proven vehicle snapshot.
 */
export async function persistCompatibilitySnapshot(
  sessionId: string,
  snapshot: CompatibilitySnapshot,
): Promise<void> {
  const serialized = JSON.stringify(snapshot);
  const writes: [string, string][] = [[sessionKey(sessionId), serialized]];
  if (snapshot.vehicle.vehicleId) {
    writes.push([vehicleKey(snapshot.vehicle.vehicleId), serialized]);
  }
  await AsyncStorage.multiSet(writes);
}

export async function loadSessionCompatibilitySnapshot(
  sessionId: string,
): Promise<CompatibilitySnapshot | null> {
  const value = await AsyncStorage.getItem(sessionKey(sessionId));
  return value ? JSON.parse(value) as CompatibilitySnapshot : null;
}

export async function loadLatestVehicleCompatibilitySnapshot(
  vehicleId: string,
): Promise<CompatibilitySnapshot | null> {
  const value = await AsyncStorage.getItem(vehicleKey(vehicleId));
  return value ? JSON.parse(value) as CompatibilitySnapshot : null;
}
