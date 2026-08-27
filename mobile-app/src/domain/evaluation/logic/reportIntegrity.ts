import { ReportManifest } from '../models/reportManifest';

export const REPORT_SCHEMA_VERSION = 'autopulse.report.v1' as const;
export const REPORT_CANONICALIZATION_VERSION = 'autopulse.canonical-json.v1' as const;
export const REPORT_HASH_ALGORITHM = 'SHA-256' as const;

export interface CanonicalReportEnvelope {
  readonly schemaVersion: typeof REPORT_SCHEMA_VERSION;
  readonly canonicalizationVersion: typeof REPORT_CANONICALIZATION_VERSION;
  readonly manifest: ReportManifest;
}

export interface ReportIntegrityReceipt {
  readonly schemaVersion: typeof REPORT_SCHEMA_VERSION;
  readonly canonicalizationVersion: typeof REPORT_CANONICALIZATION_VERSION;
  readonly hashAlgorithm: typeof REPORT_HASH_ALGORITHM;
  readonly digest: string;
  readonly canonicalPayload: string;
}

export type Sha256Hasher = (canonicalPayload: string) => Promise<string> | string;

/**
 * Produces the exact immutable bytes-as-text contract that must be hashed and
 * later verified. Object keys are sorted recursively. Array order is retained
 * because findings/evidence ordering is part of the report snapshot.
 *
 * Undefined object properties are omitted, matching JSON object semantics.
 * Undefined array entries become null, matching JSON array semantics.
 * Non-finite numbers and unsupported values are rejected rather than silently
 * normalized into a different claim.
 */
export function canonicalizeReportManifest(manifest: ReportManifest): string {
  const envelope: CanonicalReportEnvelope = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    canonicalizationVersion: REPORT_CANONICALIZATION_VERSION,
    manifest,
  };

  return canonicalizeJson(envelope);
}

export async function createReportIntegrityReceipt(
  manifest: ReportManifest,
  sha256: Sha256Hasher,
): Promise<ReportIntegrityReceipt> {
  const canonicalPayload = canonicalizeReportManifest(manifest);
  const digest = normalizeSha256Digest(await sha256(canonicalPayload));

  return Object.freeze({
    schemaVersion: REPORT_SCHEMA_VERSION,
    canonicalizationVersion: REPORT_CANONICALIZATION_VERSION,
    hashAlgorithm: REPORT_HASH_ALGORITHM,
    digest,
    canonicalPayload,
  });
}

export async function verifyReportIntegrityReceipt(
  receipt: ReportIntegrityReceipt,
  sha256: Sha256Hasher,
): Promise<boolean> {
  if (receipt.schemaVersion !== REPORT_SCHEMA_VERSION) return false;
  if (receipt.canonicalizationVersion !== REPORT_CANONICALIZATION_VERSION) return false;
  if (receipt.hashAlgorithm !== REPORT_HASH_ALGORITHM) return false;

  const actualDigest = normalizeSha256Digest(await sha256(receipt.canonicalPayload));
  return timingSafeHexEqual(actualDigest, receipt.digest);
}

function canonicalizeJson(value: unknown, seen: Set<object> = new Set()): string {
  if (value === null) return 'null';

  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('REPORT_CANONICALIZATION_NON_FINITE_NUMBER');
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'undefined') {
    throw new Error('REPORT_CANONICALIZATION_TOP_LEVEL_UNDEFINED');
  }

  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`REPORT_CANONICALIZATION_UNSUPPORTED_${typeof value.toUpperCase()}`);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error('REPORT_CANONICALIZATION_CYCLE');
    seen.add(value);
    try {
      return `[${value.map(item => item === undefined ? 'null' : canonicalizeJson(item, seen)).join(',')}]`;
    } finally {
      seen.delete(value);
    }
  }

  if (typeof value === 'object') {
    if (seen.has(value)) throw new Error('REPORT_CANONICALIZATION_CYCLE');
    seen.add(value);
    try {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter(key => record[key] !== undefined)
        .sort();
      const members = keys.map(key => `${JSON.stringify(key)}:${canonicalizeJson(record[key], seen)}`);
      return `{${members.join(',')}}`;
    } finally {
      seen.delete(value);
    }
  }

  throw new Error('REPORT_CANONICALIZATION_UNSUPPORTED_VALUE');
}

function normalizeSha256Digest(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('REPORT_INTEGRITY_INVALID_SHA256_DIGEST');
  }
  return normalized;
}

/**
 * Constant-work comparison for equal-length hex strings. This is not a
 * replacement for platform cryptography; it only avoids an early-exit string
 * comparison when checking a receipt produced by the platform SHA-256 adapter.
 */
function timingSafeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
