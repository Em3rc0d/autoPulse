export * from '../../../domain/telemetry';
import { Obd2AcquisitionEvent } from '../../../domain/telemetry';
export interface Obd2TelemetryFrame {
  timestampMs: number; // Block start epoch ms
  sequenceNumber: number; // Block sequence number
  protocolCode: number; // e.g. 1 = CAN 11bit 500k
  events: Obd2AcquisitionEvent[];
}

export interface EncodeResult {
  payload: string | Uint8Array;
  byteSize: number;
  frameCount: number;
  eventCount: number;
  readingCount: number;
  formatVersion: string;
  dictionaryBytes?: number;
  payloadBytes?: number;
}

export interface DecodeResult {
  frames: Obd2TelemetryFrame[];
  eventCount: number;
  readingCount: number;
  formatVersion: string;
  errors: string[];
}

export interface PayloadAdapter {
  readonly formatId: string;
  readonly formatVersion: string;
  readonly storageType: 'TEXT' | 'BLOB';

  encode(frames: Obd2TelemetryFrame[]): EncodeResult;
  decode(payload: string | Uint8Array): DecodeResult;
}
