export enum ProbeVerdict {
  SUPPORTED = 'SUPPORTED',
  SUPPORTED_WITH_PROFILE = 'SUPPORTED_WITH_PROFILE',
  UNKNOWN = 'UNKNOWN',
  INCOMPATIBLE_TRANSPORT = 'INCOMPATIBLE_TRANSPORT',
  INCOMPATIBLE_PROTOCOL = 'INCOMPATIBLE_PROTOCOL',
  PROBE_FAILED = 'PROBE_FAILED',
  CANCELLED = 'CANCELLED'
}

export type ProfileMatchType = 'EXACT_PROFILE_MATCH' | 'PARTIAL_PROFILE_MATCH' | 'NO_PROFILE_MATCH';

export interface ProbeResult {
  verdict: ProbeVerdict;
  probeStage: string;
  failureReason?: string;
  profileMatch: ProfileMatchType;
  connectionRetained: boolean;
  testedCombinationCount: number;
  startedAt: number;
  finishedAt: number;

  // Connection metadata
  deviceId: string;
  deviceName: string | null;
  rssi: number | null;

  // Successful Handshake Details (only populated if SUPPORTED / SUPPORTED_WITH_PROFILE / UNKNOWN)
  commandUsed?: string;
  writeCharacteristicUUID?: string;
  receiveCharacteristicUUID?: string;
  bytesWritten?: number;
  sanitizedResponse?: string;
  latencyMs?: number;
  echoDetected?: boolean;
  promptDetected?: boolean;
}
