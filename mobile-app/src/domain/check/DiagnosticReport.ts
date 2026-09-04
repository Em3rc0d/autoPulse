import { deepClone, deepFreeze } from '../shared/immutability';
import type { DiagnosticConcern } from './DiagnosticConcern';
import type { DiagnosticCoverage } from './DiagnosticCoverage';
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
  if (input.evidenceHash.trim().length === 0) throw new Error('Diagnostic report evidenceHash is required');
  assertDiagnosticVersioning(input.versions);

  return deepFreeze(deepClone({
    reportId: input.reportId,
    scan: input.scan,
    concerns: input.concerns ?? [],
    coverage: input.coverage,
    versions: input.versions,
    evidenceHash: input.evidenceHash,
    sealedAt: input.sealedAt,
  }));
}
