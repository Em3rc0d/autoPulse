export type DiagnosticFreezeFrameState =
  | 'FRAME_OBSERVED'
  | 'NO_FRAME_AVAILABLE'
  | 'SERVICE_UNSUPPORTED'
  | 'PID_NOT_AVAILABLE_IN_FRAME'
  | 'NO_DATA'
  | 'INVALID_RESPONSE'
  | 'TIMEOUT'
  | 'UNATTRIBUTED';

export interface DiagnosticFreezeFrameValue {
  readonly pid: string;
  /** Optional decoded sub-signal identity for compound PIDs (for example O2 voltage + trim). */
  readonly signalId?: string;
  readonly value: number | string | boolean;
  readonly unit?: string;
}

export interface DiagnosticFreezeFrame {
  readonly freezeFrameId: string;
  readonly frameNumber?: number;
  readonly state: DiagnosticFreezeFrameState;
  readonly sourceEndpointId: string | null;
  readonly relatedDtcObservationId?: string;
  readonly capturedAt: number | 'ECU_EVENT_TIME_UNKNOWN';
  readonly observedAt: number;
  readonly values: readonly DiagnosticFreezeFrameValue[];
  readonly evidenceIds: readonly string[];
}
