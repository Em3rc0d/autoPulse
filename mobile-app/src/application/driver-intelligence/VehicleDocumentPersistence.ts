import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VehicleDocumentRecord } from '../../domain/driver-intelligence';

const keyFor = (vehicleId: string) => `autopulse:vehicle:${vehicleId}:documents`;

export async function saveVehicleDocuments(
  vehicleId: string,
  documents: readonly VehicleDocumentRecord[],
): Promise<void> {
  await AsyncStorage.setItem(keyFor(vehicleId), JSON.stringify(documents));
}

export async function loadVehicleDocuments(vehicleId: string): Promise<VehicleDocumentRecord[]> {
  const value = await AsyncStorage.getItem(keyFor(vehicleId));
  if (!value) return [];
  const parsed = JSON.parse(value) as VehicleDocumentRecord[];
  return Array.isArray(parsed) ? parsed : [];
}
