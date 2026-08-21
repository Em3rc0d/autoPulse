export const UNKNOWN_ECU_KEY = 'UNKNOWN';

export function canonicalEcuKey(sourceAddress: string | null | undefined): string {
  const normalized = sourceAddress?.trim().toUpperCase().replace(/^0X/, '');
  return normalized || UNKNOWN_ECU_KEY;
}

export function ecuKeyToStorageAddress(ecuKey: string): number {
  if (ecuKey === UNKNOWN_ECU_KEY) return -1;

  const parsed = Number.parseInt(ecuKey, 16);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`INVALID_ECU_ADDRESS: ${ecuKey}`);
  }
  return parsed;
}

export function appendPidEvidence(
  evidenceByEcu: Record<string, string[]>,
  sourceAddress: string | null | undefined,
  pids: readonly string[]
): void {
  const key = canonicalEcuKey(sourceAddress);
  const current = evidenceByEcu[key] ?? (evidenceByEcu[key] = []);

  for (const pid of pids) {
    if (!current.includes(pid)) current.push(pid);
  }
}
