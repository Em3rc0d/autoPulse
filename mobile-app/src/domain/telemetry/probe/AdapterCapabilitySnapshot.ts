import {
  AdapterCompatibilityGrade,
  ProbeResult,
  ProfileMatchType,
} from './ProbeResult';

export type AdapterTransport = 'BLE';

export interface AdapterCapabilitySnapshot {
  schemaVersion: '1.0';
  transport: AdapterTransport;
  deviceId: string;
  deviceName: string | null;
  rssi: number | null;
  profileMatch: ProfileMatchType;
  matchedProfileId?: string;
  compatibilityGrade: AdapterCompatibilityGrade;
  assessedAt: number;

  channel: {
    writeCharacteristicUUID?: string;
    receiveCharacteristicUUID?: string;
    testedCombinationCount: number;
  };

  behavior: {
    commandUsed?: string;
    sanitizedResponse?: string;
    bytesWritten?: number;
    latencyMs?: number;
    echoObserved?: boolean;
    promptObserved?: boolean;
  };

  assessment: {
    probeStage: string;
    failureReason?: string;
    connectionRetained: boolean;
  };
}

/**
 * Converts probe evidence into an immutable release-facing capability snapshot.
 * This snapshot intentionally does not claim vehicle capabilities.
 */
export function buildAdapterCapabilitySnapshot(result: ProbeResult): AdapterCapabilitySnapshot {
  return Object.freeze({
    schemaVersion: '1.0' as const,
    transport: 'BLE' as const,
    deviceId: result.deviceId,
    deviceName: result.deviceName,
    rssi: result.rssi,
    profileMatch: result.profileMatch,
    matchedProfileId: result.matchedProfileId,
    compatibilityGrade: result.compatibilityGrade,
    assessedAt: result.finishedAt,
    channel: Object.freeze({
      writeCharacteristicUUID: result.writeCharacteristicUUID,
      receiveCharacteristicUUID: result.receiveCharacteristicUUID,
      testedCombinationCount: result.testedCombinationCount,
    }),
    behavior: Object.freeze({
      commandUsed: result.commandUsed,
      sanitizedResponse: result.sanitizedResponse,
      bytesWritten: result.bytesWritten,
      latencyMs: result.latencyMs,
      echoObserved: result.echoDetected,
      promptObserved: result.promptDetected,
    }),
    assessment: Object.freeze({
      probeStage: result.probeStage,
      failureReason: result.failureReason,
      connectionRetained: result.connectionRetained,
    }),
  });
}
