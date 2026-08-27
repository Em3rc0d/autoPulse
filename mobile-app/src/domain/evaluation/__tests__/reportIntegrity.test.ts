import { ReportManifest } from '../models/reportManifest';
import {
  canonicalizeReportManifest,
  createReportIntegrityReceipt,
  verifyReportIntegrityReceipt,
} from '../logic/reportIntegrity';

function manifest(overrides: Record<string, unknown> = {}): ReportManifest {
  return {
    id: 'manifest-1',
    vehicleSnapshot: {
      vehicleId: 'vehicle-1',
      make: 'Renault',
      model: 'Duster',
      year: 2014,
    },
    technicianId: 'technician-1',
    scope: {
      systems: ['ENGINE'],
      notes: 'Engine OBD scope only',
    },
    coverage: {
      overallLevel: 'PARTIAL',
      notes: 'ABS and airbag not evaluated',
    },
    findings: [],
    selectedEvidence: [],
    limitations: 'Only observed systems are represented.',
    engineVersion: '1.0.0',
    catalogVersion: '2026.08',
    generatedAt: '2026-08-27T21:00:00.000Z',
    ...overrides,
  } as unknown as ReportManifest;
}

function deterministicTestHash(payload: string): string {
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(8);
}

describe('reportIntegrity', () => {
  it('canonicalizes the same report identically regardless of object key insertion order', () => {
    const first = manifest({
      recommendations: 'Inspect unresolved systems separately.',
      limitations: 'Scope-limited observation.',
    });

    const second = manifest({
      limitations: 'Scope-limited observation.',
      recommendations: 'Inspect unresolved systems separately.',
    });

    expect(canonicalizeReportManifest(first)).toBe(canonicalizeReportManifest(second));
  });

  it('omits undefined object properties instead of turning them into claims', () => {
    const withoutRecommendation = manifest();
    const explicitUndefined = manifest({ recommendations: undefined });

    expect(canonicalizeReportManifest(withoutRecommendation)).toBe(
      canonicalizeReportManifest(explicitUndefined),
    );
  });

  it('rejects non-finite numeric evidence rather than silently canonicalizing it', () => {
    const invalid = manifest({
      selectedEvidence: [{
        id: 'evidence-1',
        evaluationId: 'evaluation-1',
        origin: 'LIVE_SESSION',
        type: 'TELEMETRY',
        state: 'COMMITTED',
        capturedAt: '2026-08-27T21:00:00.000Z',
        metadata: { observedValue: Number.NaN },
      }],
    });

    expect(() => canonicalizeReportManifest(invalid)).toThrow('REPORT_CANONICALIZATION_NON_FINITE_NUMBER');
  });

  it('creates and verifies a receipt over the exact canonical payload', async () => {
    const receipt = await createReportIntegrityReceipt(manifest(), deterministicTestHash);

    expect(receipt.hashAlgorithm).toBe('SHA-256');
    expect(receipt.digest).toHaveLength(64);
    await expect(verifyReportIntegrityReceipt(receipt, deterministicTestHash)).resolves.toBe(true);
  });

  it('fails verification if the immutable payload is changed', async () => {
    const receipt = await createReportIntegrityReceipt(manifest(), deterministicTestHash);
    const tampered = {
      ...receipt,
      canonicalPayload: `${receipt.canonicalPayload} `,
    };

    await expect(verifyReportIntegrityReceipt(tampered, deterministicTestHash)).resolves.toBe(false);
  });

  it('rejects a hasher that does not return a SHA-256-shaped digest', async () => {
    await expect(createReportIntegrityReceipt(manifest(), () => 'not-a-digest')).rejects.toThrow(
      'REPORT_INTEGRITY_INVALID_SHA256_DIGEST',
    );
  });
});
