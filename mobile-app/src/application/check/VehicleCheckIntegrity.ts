import type { VehicleCheckSnapshot } from './VehicleCheckReport';
import { sha256HexUtf8 } from './VehicleCheckSha256';

function assertCanonicalValue(value: unknown, path: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`NON_FINITE_REPORT_NUMBER:${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalValue(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item !== undefined) assertCanonicalValue(item, `${path}.${key}`);
    });
  }
}

function normalizeForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForCanonicalJson);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined) acc[key] = normalizeForCanonicalJson(item);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalizeVehicleCheckSnapshot(snapshot: VehicleCheckSnapshot): string {
  assertCanonicalValue(snapshot, '$');
  return JSON.stringify(normalizeForCanonicalJson(snapshot));
}

export async function sha256VehicleCheckCanonicalJson(canonicalJson: string): Promise<string> {
  return sha256HexUtf8(canonicalJson);
}

export async function sealVehicleCheckSnapshot(snapshot: VehicleCheckSnapshot): Promise<{
  canonicalJson: string;
  sha256: string;
}> {
  const canonicalJson = canonicalizeVehicleCheckSnapshot(snapshot);
  const sha256 = await sha256VehicleCheckCanonicalJson(canonicalJson);
  return { canonicalJson, sha256 };
}

export async function verifyVehicleCheckSnapshot(snapshot: VehicleCheckSnapshot, expectedSha256: string): Promise<boolean> {
  const { sha256 } = await sealVehicleCheckSnapshot(snapshot);
  return sha256.toLowerCase() === expectedSha256.toLowerCase();
}
