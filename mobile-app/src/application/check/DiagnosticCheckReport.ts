import type { CheckPhysicalPilotV4Result } from './live/CheckPhysicalPilotV4';
import type { VehicleCheckVehicleIdentity } from './VehicleCheckReport';
import { CHECK_V4_PID_WALLET } from './intelligence/PidWallet';

export const DIAGNOSTIC_CHECK_SCHEMA_VERSION = 'autopulse.diagnostic-check/v2' as const;

export interface DiagnosticCheckSnapshot {
  readonly schema: typeof DIAGNOSTIC_CHECK_SCHEMA_VERSION;
  readonly checkId: string;
  readonly generatedAt: number;
  readonly workspaceId: string;
  readonly vehicle: VehicleCheckVehicleIdentity;
  readonly pilotVersion: CheckPhysicalPilotV4Result['pilotVersion'];
  readonly protocol: CheckPhysicalPilotV4Result['protocol'];
  readonly protocolEvidence: string;
  readonly execution: {
    readonly bootstrapStandardObdStatus: CheckPhysicalPilotV4Result['bootstrapStandardObdStatus'];
    readonly scanState: CheckPhysicalPilotV4Result['scan']['state'];
    readonly coreCommandsIssued: number;
    readonly directObservationCommandsIssued: number;
    readonly targetedCommandsSelected: number;
    readonly targetedCommandsIssued: number;
    readonly targetedScanState: CheckPhysicalPilotV4Result['scan']['state'] | 'NOT_RUN';
    readonly plannerVersion: CheckPhysicalPilotV4Result['targetedEvidencePlan']['version'];
    readonly referencePidCount: number;
    readonly promotedPidReaderCount: number;
  };
  readonly capabilityAssessment: CheckPhysicalPilotV4Result['capabilityAssessment'];
  readonly dtcResults: CheckPhysicalPilotV4Result['scan']['dtcResults'];
  readonly readiness: CheckPhysicalPilotV4Result['readiness'];
  readonly pidEvidence: CheckPhysicalPilotV4Result['decodedPidEvidence'];
  readonly concerns: CheckPhysicalPilotV4Result['concerns'];
  readonly rawEvidence: CheckPhysicalPilotV4Result['rawEvidence'];
  /** Human-facing limitations safe for the normal report surface. */
  readonly limitations: readonly string[];
  /** Preserved engine/protocol detail; render only behind technical disclosure. */
  readonly technicalLimitations: readonly string[];
}

export interface StoredDiagnosticCheckReport {
  readonly id: string;
  readonly workspaceId: string;
  readonly vehicleId: string;
  readonly schemaVersion: string;
  readonly pilotVersion: string;
  readonly protocol: string;
  readonly state: 'FINAL';
  readonly snapshotJson: string;
  readonly canonicalJson: string;
  readonly sha256: string;
  readonly generatedAt: number;
  readonly createdAt: number;
}

export function buildDiagnosticCheckSnapshot(input: {
  readonly checkId: string;
  readonly workspaceId: string;
  readonly vehicle: VehicleCheckVehicleIdentity;
  readonly result: CheckPhysicalPilotV4Result;
  readonly generatedAt?: number;
}): DiagnosticCheckSnapshot {
  const generatedAt = input.generatedAt ?? Date.now();
  const targetedCommandsIssued = input.result.targetedEvidenceScan?.usage.commandsIssued ?? 0;
  return Object.freeze({
    schema: DIAGNOSTIC_CHECK_SCHEMA_VERSION,
    checkId: input.checkId,
    generatedAt,
    workspaceId: input.workspaceId,
    vehicle: Object.freeze({ ...input.vehicle }),
    pilotVersion: input.result.pilotVersion,
    protocol: input.result.protocol,
    protocolEvidence: input.result.protocolEvidence,
    execution: Object.freeze({
      bootstrapStandardObdStatus: input.result.bootstrapStandardObdStatus,
      scanState: input.result.scan.state,
      coreCommandsIssued: input.result.scanCommandCount,
      directObservationCommandsIssued: input.result.directObservationCommandCount,
      targetedCommandsSelected: input.result.targetedEvidencePlan.requests.length,
      targetedCommandsIssued,
      targetedScanState: input.result.targetedEvidenceScan?.state ?? 'NOT_RUN',
      plannerVersion: input.result.targetedEvidencePlan.version,
      referencePidCount: CHECK_V4_PID_WALLET.length,
      promotedPidReaderCount: CHECK_V4_PID_WALLET.filter(item => item.executableInCheckV4).length,
    }),
    capabilityAssessment: input.result.capabilityAssessment,
    dtcResults: Object.freeze([...input.result.scan.dtcResults]),
    readiness: input.result.readiness,
    pidEvidence: Object.freeze([...input.result.decodedPidEvidence]),
    concerns: Object.freeze([...input.result.concerns]),
    rawEvidence: Object.freeze([...input.result.rawEvidence]),
    limitations: Object.freeze([...input.result.userLimitations]),
    technicalLimitations: Object.freeze([...input.result.technicalLimitations]),
  });
}
