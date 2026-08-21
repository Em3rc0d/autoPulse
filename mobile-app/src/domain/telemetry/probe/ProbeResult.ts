export enum ProbeVerdict {
  SUPPORTED = 'SUPPORTED',
  SUPPORTED_WITH_PROFILE = 'SUPPORTED_WITH_PROFILE',
  UNKNOWN = 'UNKNOWN',
  INCOMPATIBLE_TRANSPORT = 'INCOMPATIBLE_TRANSPORT',
  INCOMPATIBLE_PROTOCOL = 'INCOMPATIBLE_PROTOCOL',
  PROBE_FAILED = 'PROBE_FAILED',
  CANCELLED = 'CANCELLED'
}

export enum AdapterCompatibilityGrade {
  CERTIFIED = 'CERTIFIED',
  COMPATIBLE = 'COMPATIBLE',
  DEGRADED = 'DEGRADED',
  UNSUPPORTED = 'UNSUPPORTED',
  UNKNOWN = 'UNKNOWN'
}

export type ProfileMatchType = 'EXACT_PROFILE_MATCH' | 'PARTIAL_PROFILE_MATCH' | 'NO_PROFILE_MATCH';

export interface ProbeResult {
  /**
   * Legacy transport/probe verdict kept for existing UI compatibility.
   * Release compatibility claims MUST use compatibilityGrade instead.
   */
  verdict: ProbeVerdict;
  compatibilityGrade: AdapterCompatibilityGrade;
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
