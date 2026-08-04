export interface EncodedTelemetryBlock {
  sessionId: string;
  blockSequence: number;
  windowIndex: number;
  startedAt: number;
  endedAt: number;
  isPartial: boolean;

  formatId: string;
  formatVersion: number;
  codecImplementationVersion: string;
  decoderVersion: string;
  storageType: 'BLOB';

  payload: Uint8Array;
  payloadByteLength: number;
  crcAlgorithm: string;
  payloadCrc: number;

  eventCount: number;
  readingCount: number;
  firstEventSequence: number;
  lastEventSequence: number;
}
