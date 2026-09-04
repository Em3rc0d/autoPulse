export interface DiagnosticMonitorResult {
  readonly monitorResultId: string;
  readonly sourceEndpointId: string | null;
  readonly monitorId: string;
  readonly componentId?: string;
  readonly testValue?: number;
  readonly minimumLimit?: number;
  readonly maximumLimit?: number;
  readonly unit?: string;
  readonly outcome: 'WITHIN_LIMITS' | 'OUTSIDE_LIMITS' | 'UNKNOWN' | 'UNSUPPORTED' | 'INVALID';
  readonly meaning: string | 'UNKNOWN';
  readonly evidenceIds: readonly string[];
  readonly observedAt: number;
}
