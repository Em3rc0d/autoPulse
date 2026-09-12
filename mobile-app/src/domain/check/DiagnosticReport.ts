import { deepClone, deepFreeze } from '../shared/immutability';
import type { DiagnosticConcern } from './DiagnosticConcern';
import type { DiagnosticCoverage } from './DiagnosticCoverage';
import {
  assertSha256,
  assertValidDiagnosticConcerns,
  assertValidDiagnosticCoverage,
  assertValidDiagnosticScan,
} from './DiagnosticDomainValidation';
import type { DiagnosticScan } from './DiagnosticScan';
import { isDiagnosticScanTerminal } from './DiagnosticScanState';
import { assertDiagnosticVersioning, DiagnosticVersioning } from './DiagnosticVersioning';

export interface DiagnosticReport {
  readonly reportId: string;
  readonly scan: DiagnosticScan;
  readonly concerns: readonly DiagnosticConcern[];
  readonly coverage: DiagnosticCoverage;
  readonly versions: DiagnosticVersioning;
  readonly evidenceHash: string;
  readonly sealedAt: number;
}

export interface DiagnosticReportInput extends Omit<DiagnosticReport, 'scan' | 'concerns' | 'coverage' | 'versions'> {
  readonly scan: DiagnosticScan;
  readonly concerns?: readonly DiagnosticConcern[];
  readonly coverage: DiagnosticCoverage;
  readonly versions: DiagnosticVersioning;
}

export function createDiagnosticReport(input: DiagnosticReportInput): DiagnosticReport {
  if (!isDiagnosticScanTerminal(input.scan.state)) {
    throw new Error(`Cannot seal report from non-terminal scan state: ${input.scan.state}`);
  }
  if (input.reportId.trim().length === 0) throw new Error('Diagnostic reportId is required');
  if (!Number.isFinite(input.sealedAt)) throw new Error('Diagnostic report sealedAt must be finite');

  assertValidDiagnosticScan(input.scan);
  assertValidDiagnosticCoverage(input.scan, input.coverage);
  assertValidDiagnosticConcerns(input.scan, input.concerns ?? []);
  assertSha256(input.evidenceHash, 'Diagnostic report evidenceHash');
  assertDiagnosticVersioning(input.versions);

  if (input.scan.endedAt === undefined) {
    throw new Error(`Terminal diagnostic scan ${input.scan.scanId} requires endedAt before sealing`);
  }
  if (input.sealedAt < input.scan.endedAt) {
    throw new Error('Diagnostic report sealedAt cannot precede scan endedAt');
  }

  return deepFreeze(deepClone({
    reportId: input.reportId,
    scan: input.scan,
    concerns: input.concerns ?? [],
    coverage: input.coverage,
    versions: input.versions,
    evidenceHash: input.evidenceHash.toLowerCase(),
    sealedAt: input.sealedAt,
  }));
}
