export type DiagnosticMilState = 'ON' | 'OFF' | 'UNKNOWN';
export type DiagnosticMonitorCompletion = 'COMPLETE' | 'INCOMPLETE' | 'NOT_APPLICABLE' | 'UNKNOWN';
export type DiagnosticReadinessState = 'READY' | 'NOT_READY' | 'NOT_SUPPORTED' | 'UNKNOWN';

export interface DiagnosticReadinessMonitor {
  readonly monitorId: string;
  readonly supported: boolean | 'UNKNOWN';
  readonly completion: DiagnosticMonitorCompletion;
  /** Presentation-safe state. NOT_READY is diagnostic state, never mechanical failure. */
  readonly readinessState: DiagnosticReadinessState;
}

export interface DiagnosticReadiness {
  readonly readinessId: string;
  readonly sourceEndpointId: string | null;
  readonly cycle: 'SINCE_DTC_CLEAR' | 'CURRENT_DRIVE_CYCLE' | 'UNKNOWN';
  readonly milState: DiagnosticMilState;
  readonly confirmedDtcCount?: number;
  readonly monitors: readonly DiagnosticReadinessMonitor[];
  readonly evidenceIds: readonly string[];
  readonly observedAt: number;
}
