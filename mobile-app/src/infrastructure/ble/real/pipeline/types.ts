export type CommandFamily =
  | 'ELM_AT'
  | 'OBD_MODE_01'
  | 'OBD_MODE_03'
  | 'OBD_MODE_09'
  | 'RAW_DIAGNOSTIC'
  | 'VENDOR_SPECIFIC'
  | 'UNKNOWN';

export interface CommandRequest {
  id: string;
  command: string;
  family: CommandFamily;
  expectedService?: string;
  expectedPid?: string;
  timeoutMs: number;
}

export type AccumulatorCompletionReason =
  | 'PROMPT_RECEIVED'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'CANCELLED'
  | 'MAX_BYTES_REACHED'
  | 'WRITE_FAILED';

export interface BleFragment {
  receivedAt: number;
  base64: string;
  decodedText: string;
}

export interface RawElmResponse {
  fragments: BleFragment[];
  accumulatedText: string;
  completionReason: AccumulatorCompletionReason;
  startedAt: number;
  finishedAt: number;
  latencyMs: number;
}

export interface NormalizedElmResponse {
  rawText: string;
  normalizedText: string;
  echoLines: string[];
  statusLines: string[];
  candidateHexLines: string[];
  unknownLines: string[];
  promptDetected: boolean;
}

export type LineClassification =
  | 'COMMAND_ECHO'
  | 'AT_RESPONSE'
  | 'ELM_STATUS'
  | 'ELM_ERROR'
  | 'OBD_HEX_CANDIDATE'
  | 'PROMPT'
  | 'UNKNOWN_TEXT'
  | 'MALFORMED_HEX';

export interface ClassifiedLine {
  originalText: string;
  normalizedText: string;
  classification: LineClassification;
}

export type ObdFrameValidity =
  | 'VALID'
  | 'INCOMPLETE'
  | 'MALFORMED'
  | 'UNSUPPORTED_ENVELOPE'
  | 'AMBIGUOUS';

export interface ObdFrame {
  sourceAddress: string | null;
  service: string;
  pid: string | null;
  payloadBytes: number[];
  declaredLength: number | null;
  rawLine: string;
  validity: ObdFrameValidity;
}

export interface NegativeObdResponse {
  requestedService: string;
  responseCode: string;
  sourceEcu: string | null;
  rawLine: string;
}

export interface DecodedValue {
  type: string;
  value: any;
  unit: string;
}

export type CommandResultStatus =
  | 'SUCCESS_DECODED'
  | 'SUCCESS_RAW'
  | 'NO_DATA'
  | 'ELM_ERROR'
  | 'INVALID_RESPONSE'
  | 'PARTIAL'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'CANCELLED'
  | 'WRITE_FAILED';

export interface CommandResult {
  request: CommandRequest;
  rawResponse: RawElmResponse | null;
  normalizedResponse: NormalizedElmResponse | null;
  classifiedLines: ClassifiedLine[];
  obdFrames: ObdFrame[];
  negativeResponses: NegativeObdResponse[];
  decodedValues: DecodedValue[];
  status: CommandResultStatus;
  errors: string[];
  latencyMs: number;
}
