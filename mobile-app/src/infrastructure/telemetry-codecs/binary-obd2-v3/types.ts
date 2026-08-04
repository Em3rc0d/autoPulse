export interface BinaryObd2V3Target {
  sourceAddress: number;
  service: number;
  parameterIdentifier: number;
}

export interface BinaryObd2V3Signal {
  targetIndex: number;
  signalIdIndex: number;
  unitIndex: number;
}

export interface BinaryObd2V3Reading {
  signalIndex: number;
  qualityIndex: number;
  value: number;
}

export interface BinaryObd2V3NegativeResponse {
  requestedService: number;
  responseCode: number;
  sourceTargetIndex: number;
}

export interface BinaryObd2V3RawFragment {
  receivedDeltaMs: number;
  bytes: Uint8Array;
}

export interface BinaryObd2V3Frame {
  transportIndex: number;
  sourceAddress: number;
  destinationAddress: number;
  service: number;
  pid: number;
  payloadBytes: Uint8Array;
  validityIndex: number;
}

export interface BinaryObd2V3Event {
  statusIndex: number;
  completionReasonIndex: number;
  requestSequence: number;
  requestedDeltaMs: number;
  completedDeltaMs: number;
  latencyMs: number;
  targetIndex: number;

  readings: BinaryObd2V3Reading[];
  negativeResponses: BinaryObd2V3NegativeResponse[];
  rawFragments: BinaryObd2V3RawFragment[];
  frames: BinaryObd2V3Frame[];
}

export interface BinaryObd2V3Input {
  magic: number; // 0x3344424F "OBD3" -> wait, format ID is BINARY_OBD2_V3 so maybe just "OBD3"
  formatVersion: number; // 3

  targets: BinaryObd2V3Target[];
  signals: BinaryObd2V3Signal[];

  // Dictionaries
  strings: string[]; // for signalIds, units, commands if needed

  events: BinaryObd2V3Event[];
}
