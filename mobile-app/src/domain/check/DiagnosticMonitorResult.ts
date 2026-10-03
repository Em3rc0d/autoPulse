import type { DiagnosticEvidenceValue } from './DiagnosticEvidence';

export interface DiagnosticMonitorMeaning {
  readonly label: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
}

export interface DiagnosticMonitorResult {
  readonly monitorResultId: string;
  readonly sourceEndpointId: string | null;
  readonly monitorId: string;
  readonly componentId?: string;
  /** Raw monitor payload/value is retained even when engineering scaling is not proven. */
  readonly rawValue?: DiagnosticEvidenceValue;
  /** Engineering value only when the promoted decoder proves scale/units. */
  readonly testValue?: number;
  readonly minimumLimit?: number;
  readonly maximumLimit?: number;
  readonly unit?: string;
  readonly outcome: 'WITHIN_LIMITS' | 'OUTSIDE_LIMITS' | 'UNKNOWN' | 'UNSUPPORTED' | 'INVALID';
  /** Human meaning is optional and may exist only with reviewed provenance. */
  readonly meaning?: DiagnosticMonitorMeaning;
  readonly provenance: string;
  readonly evidenceIds: readonly string[];
  readonly observedAt: number;
}
