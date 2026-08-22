import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompatibilitySnapshot } from '../../domain/diagnostics';
import type {
  DriverAdvisory,
  VehicleDocumentRecord,
  VehicleHealthState,
} from '../../domain/driver-intelligence';

export interface PhysicalValidationReceipt {
  schemaVersion: 1;
  sessionId: string;
  vehicleId?: string;
  capturedAt: number;
  compatibility: CompatibilitySnapshot;
  health: VehicleHealthState;
  documents: readonly VehicleDocumentRecord[];
  advisories: readonly DriverAdvisory[];
}

const sessionKey = (sessionId: string) => `autopulse:physical-validation:session:${sessionId}`;
const vehicleKey = (vehicleId: string) => `autopulse:physical-validation:vehicle:${vehicleId}:latest`;

export function buildPhysicalValidationReceipt(input: {
  sessionId: string;
  vehicleId?: string;
  capturedAt?: number;
  compatibility: CompatibilitySnapshot;
  health: VehicleHealthState;
  documents: readonly VehicleDocumentRecord[];
  advisories: readonly DriverAdvisory[];
}): PhysicalValidationReceipt {
  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    vehicleId: input.vehicleId,
    capturedAt: input.capturedAt ?? Date.now(),
    compatibility: input.compatibility,
    health: input.health,
    documents: [...input.documents],
    advisories: [...input.advisories],
  };
}

export async function persistPhysicalValidationReceipt(receipt: PhysicalValidationReceipt): Promise<void> {
  const serialized = JSON.stringify(receipt);
  const writes: [string, string][] = [[sessionKey(receipt.sessionId), serialized]];
  if (receipt.vehicleId) writes.push([vehicleKey(receipt.vehicleId), serialized]);
  await AsyncStorage.multiSet(writes);
}

export async function loadSessionPhysicalValidationReceipt(
  sessionId: string,
): Promise<PhysicalValidationReceipt | null> {
  const value = await AsyncStorage.getItem(sessionKey(sessionId));
  return value ? JSON.parse(value) as PhysicalValidationReceipt : null;
}

export async function loadLatestVehiclePhysicalValidationReceipt(
  vehicleId: string,
): Promise<PhysicalValidationReceipt | null> {
  const value = await AsyncStorage.getItem(vehicleKey(vehicleId));
  return value ? JSON.parse(value) as PhysicalValidationReceipt : null;
}
