export type DiagnosticCoverageOutcome = 'COMPLETE' | 'PARTIAL' | 'UNSUPPORTED' | 'UNAVAILABLE' | 'NOT_EVALUATED';

export interface DiagnosticServiceCoverage {
  readonly endpointId: string | null;
  readonly service: string;
  readonly outcome: DiagnosticCoverageOutcome;
  readonly detail?: string;
}

export interface DiagnosticCoverage {
  readonly discoveredEndpointIds: readonly string[];
  readonly scannedEndpointIds: readonly string[];
  readonly services: readonly DiagnosticServiceCoverage[];
  readonly availableEvidenceFamilies: readonly string[];
  readonly limitations: readonly string[];
}

export function hasCompleteDtcCoverage(coverage: DiagnosticCoverage, services: readonly string[]): boolean {
  if (coverage.scannedEndpointIds.length === 0) return false;
  return coverage.scannedEndpointIds.every(endpointId =>
    services.every(service => coverage.services.some(entry =>
      entry.endpointId === endpointId && entry.service === service && entry.outcome === 'COMPLETE',
    )),
  );
}
