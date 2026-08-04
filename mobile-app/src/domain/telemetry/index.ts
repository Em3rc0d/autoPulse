export type Obd2Outcome = 'VALUE' | 'TIMEOUT' | 'UNSUPPORTED' | 'INVALID_RESPONSE' | 'CONNECTION_ERROR' | 'CANCELLED';
export type TelemetryQuality = 'VALID' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE' | 'INVALID';
export type Obd2ErrorCode = 'TIMEOUT' | 'MALFORMED_RESPONSE' | 'CHECKSUM_FAILURE' | 'ADAPTER_DISCONNECTED' | 'UNSUPPORTED_PID' | 'REQUEST_CANCELLED' | 'UNKNOWN_ERROR';
export type ConnectionState = 'CONNECTED' | 'DISCONNECTED';

export interface Obd2DecodedReading {
  signalDefinitionId: string;
  normalizedValue: number;
  unit: string;
  quality: TelemetryQuality;
  rawNumericValue?: number;
}

export interface Obd2AcquisitionEvent {
  requestSequence: number;
  ecuAddress?: number;
  service?: number;
  pid?: number;
  requestDelta: number;
  responseDelta?: number;
  decodeDelta?: number;
  outcome: Obd2Outcome;
  errorCode?: Obd2ErrorCode;
  connectionState: ConnectionState;
  readings: Obd2DecodedReading[];
}

export interface TelemetryBlockMetadata {
  sessionId: string;
  sequenceNumber: number;
  blockStartMs: number;
  blockEndMs: number;
  format: string;
  formatVersion: string;
  codec: string;
  dictionaryVersion: string;
  dictionaryHash: string;
}
export * from './models/ObdAcquisitionEvent';
export * from './models/UnencodedTelemetryBlock';
export * from './models/EncodedTelemetryBlock';
export * from './logic/TelemetryBlockAssembler';
export * from './models/sessionSummaryResult';
