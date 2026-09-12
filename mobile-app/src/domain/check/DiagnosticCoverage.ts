import type { DiagnosticEvidenceSourceType } from './DiagnosticEvidence';

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
  readonly availableEvidenceFamilies: readonly DiagnosticEvidenceSourceType[];
  readonly limitations: readonly string[];
}

/**
 * Complete DTC coverage is bounded by endpoints actually discovered in this scan.
 * A discovered-but-unscanned endpoint prevents COMPLETE even when every scanned
 * endpoint completed the requested services.
 */
export function hasCompleteDtcCoverage(coverage: DiagnosticCoverage, services: readonly string[]): boolean {
  const discoveredEndpointIds = new Set(coverage.discoveredEndpointIds);
  const scannedEndpointIds = new Set(coverage.scannedEndpointIds);

  if (discoveredEndpointIds.size === 0 || services.length === 0) return false;
  if (scannedEndpointIds.size !== discoveredEndpointIds.size) return false;
  if ([...discoveredEndpointIds].some(endpointId => !scannedEndpointIds.has(endpointId))) return false;

  return [...discoveredEndpointIds].every(endpointId =>
    services.every(service => coverage.services.some(entry =>
      entry.endpointId === endpointId && entry.service === service && entry.outcome === 'COMPLETE',
    )),
  );
}
