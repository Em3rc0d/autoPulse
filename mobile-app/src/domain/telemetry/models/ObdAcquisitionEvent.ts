export interface ObdReading {
  signalId: string;
  service: string;
  pid: string | null;
  value: any;
  unit: string;
  rawBytes: number[];
  origin: 'OBD2' | 'VIRTUAL';
  quality: 'GOOD' | 'DEGRADED' | 'INVALID';
  sourceEcu: string | null;
  observedAt: number;
}

export type ObdAcquisitionStatus =
  | 'SUCCESS'
  | 'NO_DATA'
  | 'NEGATIVE_RESPONSE'
  | 'ERROR'
  | 'INVALID_RESPONSE'
  | 'PARTIAL'
  | 'TIMEOUT'
  | 'CANCELLED';

export interface ObdAcquisitionEvent {
  sessionId: string;
  sequenceNumber: number;
  requestId: string;
  requestedAt: number;
  completedAt: number;
  command: string;
  commandFamily: string;
  completionReason: string;
  latencyMs: number;
  rawFragments: { receivedAt: number; decodedText: string }[];
  rawText: string;
  frames: { service: string; pid: string | null; payloadBytes: number[] }[];
  decodedReadings: ObdReading[];
  negativeResponses: { requestedService: string; responseCode: string }[];
  status: ObdAcquisitionStatus;
  warnings: string[];
}
