import type { CompatibilitySnapshot } from '../../domain/diagnostics';
import type { SessionSummaryResult } from '../../domain/telemetry/models/sessionSummaryResult';

export const VEHICLE_CHECK_SCHEMA_VERSION = 'autopulse.vehicle-check/v1' as const;

export type VehicleCheckSignalKey =
  | 'ENGINE_RPM'
  | 'VEHICLE_SPEED'
  | 'ENGINE_COOLANT'
  | 'ECU_VOLTAGE'
  | 'ADAPTER_VOLTAGE';

export type VehicleCheckObservationState =
  | 'OBSERVED'
  | 'PROBED_NO_DATA'
  | 'INVALID_ONLY'
  | 'NOT_EVALUATED';

export interface VehicleCheckVehicleIdentity {
  readonly vehicleId: string;
  readonly alias?: string;
  readonly make?: string;
  readonly model?: string;
  readonly year?: number;
}

export interface VehicleCheckSignalObservation {
  readonly key: VehicleCheckSignalKey;
  readonly label: string;
  readonly unit: string;
  readonly source: 'ECU' | 'ADAPTER';
  readonly state: VehicleCheckObservationState;
  readonly sourceSignalId?: string;
  readonly validReadingsCount: number;
  readonly noDataCount: number;
  readonly invalidCount: number;
  readonly min: number | null;
  readonly avg: number | null;
  readonly max: number | null;
}

export interface VehicleCheckCoverage {
  readonly targetSignals: number;
  readonly observedSignals: number;
  readonly probedNoDataSignals: number;
  readonly invalidOnlySignals: number;
  readonly notEvaluatedSignals: number;
  /** Percentage of the bounded V1 target signal set that was actually observed. */
  readonly observedPercent: number;
}

export interface VehicleCheckCompatibilitySummary {
  readonly available: boolean;
  readonly capturedAt?: number;
  readonly protocol: string;
  readonly standardObdReachable: boolean | null;
  readonly discoveredEcuCount: number;
  readonly enhancedDiagnosticsAdvertised: boolean | null;
  readonly enhancedDiagnosticsProbed: boolean | null;
}

export interface VehicleCheckSnapshot {
  readonly schema: typeof VEHICLE_CHECK_SCHEMA_VERSION;
  readonly checkId: string;
  readonly generatedAt: number;
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly vehicle: VehicleCheckVehicleIdentity;
  readonly acquisition: {
    readonly mode: string;
    readonly adapterId?: string;
    readonly protocolId?: string;
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly durationSeconds?: number;
  };
  readonly evidence: {
    readonly sessionIntegrity: string;
    readonly interrupted: boolean;
    readonly terminationReason?: string;
    readonly expectedBlocksCount: number;
    readonly foundBlocksCount: number;
    readonly corruptedBlocksCount: number;
    readonly gapsDetectedCount: number;
    readonly totalEventsCount: number;
    readonly totalReadingsCount: number;
  };
  readonly compatibility: VehicleCheckCompatibilitySummary;
  readonly signals: readonly VehicleCheckSignalObservation[];
  readonly coverage: VehicleCheckCoverage;
  readonly limitations: readonly string[];
  /** Eligibility for an accompanied Pilot-0 review, not a mechanical PASS verdict. */
  readonly pilotEligible: boolean;
}

export interface VehicleCheckBuildInput {
  readonly checkId: string;
  readonly generatedAt?: number;
  readonly summary: SessionSummaryResult;
  readonly vehicle: VehicleCheckVehicleIdentity;
  readonly compatibility?: CompatibilitySnapshot | null;
}

export interface StoredVehicleCheckReport {
  readonly id: string;
  readonly workspaceId: string;
  readonly vehicleId: string;
  readonly sessionId: string;
  readonly schemaVersion: string;
  readonly snapshotJson: string;
  readonly canonicalJson: string;
  readonly sha256: string;
  readonly generatedAt: number;
  readonly createdAt: number;
}
