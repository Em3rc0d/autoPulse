import { LiveSessionId, VehicleId, WorkspaceId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';

export enum SessionIntegrityState {
  COMPLETE = 'COMPLETE',
  PARTIAL = 'PARTIAL',
  DEGRADED = 'DEGRADED',
  CORRUPTED = 'CORRUPTED',
  UNAVAILABLE = 'UNAVAILABLE'
}

export enum SessionAcquisitionMode {
  REAL_BLE = 'REAL_BLE',
  LAPTOP_REPLAY = 'LAPTOP_REPLAY',
  VIRTUAL_PREVIEW = 'VIRTUAL_PREVIEW'
}

export interface SignalSummary {
  readonly signalId: string;
  readonly validReadingsCount: number;
  readonly noDataCount: number;
  readonly invalidCount: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly avg: number | null;
  readonly firstValidAt: UtcIsoTimestamp | null;
  readonly lastValidAt: UtcIsoTimestamp | null;
}

export interface SessionSummaryResult {
  readonly sessionId: LiveSessionId;
  readonly vehicleId: VehicleId;
  readonly workspaceId: WorkspaceId;

  // Identity
  readonly acquisitionMode: SessionAcquisitionMode;
  readonly adapterId?: string;
  readonly protocolId?: string;

  // Time
  readonly startedAt: UtcIsoTimestamp;
  readonly endedAt?: UtcIsoTimestamp;
  readonly durationSeconds?: number;
  readonly terminationReason?: string;
  readonly isInterrupted: boolean;

  // Persistence Stats
  readonly expectedBlocksCount: number;
  readonly foundBlocksCount: number;
  readonly validBlocksCount: number;
  readonly completeBlocksCount: number;
  readonly partialBlocksCount: number;
  readonly corruptedBlocksCount: number;
  readonly unsupportedBlocksCount: number;
  readonly missingBlocksCount: number;

  readonly firstWindowIndex?: number;
  readonly lastWindowIndex?: number;
  readonly firstSequence?: number;
  readonly lastSequence?: number;

  readonly gapsDetectedCount: number;

  readonly totalEventsCount: number;
  readonly totalReadingsCount: number;

  readonly integrityState: SessionIntegrityState;

  // Metric Summaries
  readonly signalSummaries: Record<string, SignalSummary>;
}
