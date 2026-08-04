import { Obd2AcquisitionEvent } from '../../../domain/telemetry';

export interface CodecContext {
  dictionaryVersion?: string;
  // Extensible for future context requirements like specific ECU layouts
}

export interface EncodeResult {
  payload: string | Uint8Array;
  byteSize: number;
  eventCount: number;
  readingCount: number;
  formatVersion: string;
  dictionaryBytes?: number;
  payloadBytes?: number;
}

export interface DecodeResult {
  events: Obd2AcquisitionEvent[];
  eventCount: number;
  readingCount: number;
  formatVersion: string;
  errors: string[];
}

export interface IntegrityResult {
  valid: boolean;
  expectedChecksum?: string;
  actualChecksum?: string;
  error?: string;
}

export interface TelemetryBlockCodec {
  readonly codecId: string;
  readonly formatId: string;
  readonly formatVersion: string;

  encode(events: Obd2AcquisitionEvent[], context?: CodecContext): EncodeResult;
  decode(payload: string | Uint8Array, context?: CodecContext): DecodeResult;
  validate(payload: string | Uint8Array): IntegrityResult;
}
