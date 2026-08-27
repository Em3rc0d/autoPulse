export interface ReportIntegrityHasher {
  sha256Hex(payload: string): Promise<string>;
}

function normalizeCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeCanonical);
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      const nested = input[key];
      if (nested !== undefined) output[key] = normalizeCanonical(nested);
    }
    return output;
  }
  return value;
}

/** Stable JSON representation used as the signed report payload. */
export function canonicalizeReportPayload(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}

export async function verifyReportIntegrity(
  canonicalPayload: string,
  expectedHash: string,
  hasher: ReportIntegrityHasher,
): Promise<boolean> {
  const actual = await hasher.sha256Hex(canonicalPayload);
  return actual.toLowerCase() === expectedHash.toLowerCase();
}
