import { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import { ITelemetryBlockRepository } from '../../domain/telemetry/repositories/TelemetryBlockRepository';
import { BinaryObd2V3Codec } from '../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import {
  SessionSummaryResult,
  SessionIntegrityState,
  SessionAcquisitionMode,
  SignalSummary
} from '../../domain/telemetry/models/sessionSummaryResult';
import { LiveSessionId, VehicleId, WorkspaceId } from '../../domain/shared/identifiers';
import { UtcIsoTimestamp, parseUtcIsoTimestamp } from '../../domain/shared/timestamps';

function isCodecCorruption(err: any): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  return msg.includes('CORRUPTED') || 
         msg.includes('UNSUPPORTED') || 
         msg.includes('TRUNCATED') || 
         err instanceof RangeError;
}

export class SessionSummaryBuildAbortedError extends Error {
  constructor(message?: string) {
    super(message || 'SESSION_SUMMARY_BUILD_ABORTED');
    this.name = 'SessionSummaryBuildAbortedError';
  }
}

export class SessionSummaryBuilder {
  constructor(
    private liveSessionRepository: LiveSessionRepository,
    private telemetryBlockRepository: ITelemetryBlockRepository,
    private codec: BinaryObd2V3Codec
  ) {}

  async build(
    workspaceId: string,
    sessionId: string,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<SessionSummaryResult> {
    const session = await this.liveSessionRepository.getSessionById(workspaceId, sessionId);
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const blocks = await this.telemetryBlockRepository.getAllBlocksForSession(sessionId);

    // Yield control initially
    await new Promise(resolve => setTimeout(resolve, 0));

    const expectedBlocksCount = session.totalBlocks || 0; // The controller counted them
    const foundBlocksCount = blocks.length;
    let validBlocksCount = 0;
    let completeBlocksCount = 0;
    let partialBlocksCount = 0;
    let corruptedBlocksCount = 0;
    let unsupportedBlocksCount = 0;

    let firstWindowIndex: number | undefined = undefined;
    let lastWindowIndex: number | undefined = undefined;
    let firstSequence: number | undefined = undefined;
    let lastSequence: number | undefined = undefined;

    let gapsDetectedCount = 0;
    let totalEventsCount = 0;
    let totalReadingsCount = 0;

    const signalMap = new Map<string, {
      signalId: string;
      validReadingsCount: number;
      noDataCount: number;
      invalidCount: number;
      min: number | null;
      max: number | null;
      avg: number | null;
      firstValidAt: UtcIsoTimestamp | null;
      lastValidAt: UtcIsoTimestamp | null;
    }>();

    let prevWindowIndex = -1;
    let prevLastSequence: number | undefined = undefined;

    for (let i = 0; i < blocks.length; i++) {
      if (abortSignal?.aborted) {
        throw new SessionSummaryBuildAbortedError();
      }

      const result = blocks[i];
      if (result.status !== 'VALID') {
        if (result.status === 'CORRUPTED') {
          corruptedBlocksCount++;
        }
        continue;
      }

      const block = result.block;
      
      if (firstWindowIndex === undefined || block.windowIndex < firstWindowIndex) {
        firstWindowIndex = block.windowIndex;
      }
      if (lastWindowIndex === undefined || block.windowIndex > lastWindowIndex) {
        lastWindowIndex = block.windowIndex;
      }

      if (firstSequence === undefined || block.firstEventSequence < firstSequence) {
        firstSequence = block.firstEventSequence;
      }
      if (lastSequence === undefined || block.lastEventSequence > lastSequence) {
        lastSequence = block.lastEventSequence;
      }

      if (prevWindowIndex !== -1 && block.windowIndex > prevWindowIndex + 1) {
        gapsDetectedCount++;
      }
      if (prevLastSequence !== undefined && (block.firstEventSequence > prevLastSequence + 1 || block.firstEventSequence <= prevLastSequence)) {
        gapsDetectedCount++;
      }
      prevWindowIndex = block.windowIndex;
      prevLastSequence = block.lastEventSequence;

      // Decode the block using the codec
      try {
        const decoded = this.codec.decode(block.payload, block);

        validBlocksCount++;
        if (block.isPartial) {
          partialBlocksCount++;
        } else {
          completeBlocksCount++;
        }

        for (const event of decoded.events) {
          totalEventsCount++;

          if (event.status === 'NO_DATA') {
            const sigId = event.command;
            let sigSummary = signalMap.get(sigId);
            if (!sigSummary) {
              sigSummary = {
                signalId: sigId,
                validReadingsCount: 0,
                noDataCount: 0,
                invalidCount: 0,
                min: null,
                max: null,
                avg: null,
                firstValidAt: null,
                lastValidAt: null
              };
            }
            sigSummary.noDataCount++;
            signalMap.set(sigId, sigSummary);
            continue; // NO_DATA events don't have decoded readings usually, but if they do, we skip them anyway
          }

          for (const reading of event.decodedReadings) {
            totalReadingsCount++;

            const sigId = reading.signalId;
            let sigSummary = signalMap.get(sigId);
            if (!sigSummary) {
              sigSummary = {
                signalId: sigId,
                validReadingsCount: 0,
                noDataCount: 0,
                invalidCount: 0,
                min: null,
                max: null,
                avg: null,
                firstValidAt: null,
                lastValidAt: null
              };
            }

            if (reading.quality === 'INVALID') {
              sigSummary.invalidCount++;
            } else {
              // Valid reading
              const v = reading.value;
              sigSummary.validReadingsCount++;
              sigSummary.min = sigSummary.min === null ? v : Math.min(sigSummary.min, v);
              sigSummary.max = sigSummary.max === null ? v : Math.max(sigSummary.max, v);
              sigSummary.avg = sigSummary.avg === null ? v : sigSummary.avg + v;
              sigSummary.firstValidAt = sigSummary.firstValidAt === null ? parseUtcIsoTimestamp(new Date(reading.observedAt).toISOString()) : sigSummary.firstValidAt;
              sigSummary.lastValidAt = parseUtcIsoTimestamp(new Date(reading.observedAt).toISOString());
            }
            signalMap.set(sigId, sigSummary);
          }
        }
      } catch (err) {
        const error = err as Error;
        if (isCodecCorruption(error)) {
          console.warn(`[SessionSummaryBuilder] Failed to decode block ${block.windowIndex} for session ${sessionId}:`, error);
          if (error.message.startsWith('UNSUPPORTED')) {
            unsupportedBlocksCount++;
          } else {
            corruptedBlocksCount++;
          }
        } else {
          // Unexpected error, do not swallow it as corruption
          throw err;
        }
      }

      // Yield every 10 blocks to prevent UI starvation
      if (i % 10 === 0) {
        if (onProgress) {
          const denominator = Math.max(expectedBlocksCount, blocks.length, 1);
          onProgress(Math.min(1, i / denominator));
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Finalize averages
    const signalSummaries: Record<string, SignalSummary> = {};
    for (const [sigId, summary] of signalMap.entries()) {
      let finalAvg = null;
      if (summary.validReadingsCount > 0 && summary.avg !== null) {
        finalAvg = summary.avg / summary.validReadingsCount;
      }
      signalSummaries[sigId] = {
        ...summary,
        avg: finalAvg
      };
    }

    const missingBlocksCount = Math.max(0, expectedBlocksCount - foundBlocksCount);

    let integrityState = SessionIntegrityState.COMPLETE;

    if (corruptedBlocksCount > 0 || gapsDetectedCount > 0 || expectedBlocksCount !== foundBlocksCount) {
      integrityState = SessionIntegrityState.DEGRADED;
    } else if (session.status === 'INTERRUPTED' || partialBlocksCount > 0) {
      integrityState = SessionIntegrityState.PARTIAL;
    }

    if (corruptedBlocksCount === foundBlocksCount && foundBlocksCount > 0) {
      integrityState = SessionIntegrityState.CORRUPTED;
    } else if (foundBlocksCount === 0) {
      integrityState = SessionIntegrityState.UNAVAILABLE;
    }

    let mode = SessionAcquisitionMode.REAL_BLE;
    if (session.transportType === 'LAPTOP_REPLAY') {
      mode = SessionAcquisitionMode.LAPTOP_REPLAY;
    }

    const adapterId = session.adapterInstanceId;

    return {
      sessionId: session.id as unknown as LiveSessionId,
      vehicleId: session.vehicleId as unknown as VehicleId,
      workspaceId: workspaceId as unknown as WorkspaceId,

      acquisitionMode: mode,
      adapterId: adapterId,
      protocolId: session.protocolCode || undefined,

      startedAt: session.startedAt ? parseUtcIsoTimestamp(new Date(session.startedAt).toISOString()) : ('' as UtcIsoTimestamp),
      endedAt: session.endedAt ? parseUtcIsoTimestamp(new Date(session.endedAt).toISOString()) : undefined,
      durationSeconds: session.startedAt && session.endedAt ? Math.floor((session.endedAt - session.startedAt) / 1000) : undefined,
      terminationReason: session.stopReason || session.failureCode || undefined,
      isInterrupted: session.status === 'INTERRUPTED' || session.status === 'FAILED',

      expectedBlocksCount,
      foundBlocksCount,
      validBlocksCount,
      completeBlocksCount,
      partialBlocksCount,
      corruptedBlocksCount,
      unsupportedBlocksCount,
      missingBlocksCount, // NOTE: added to domain later if necessary, but calculated properly

      firstWindowIndex,
      lastWindowIndex,
      firstSequence,
      lastSequence,

      gapsDetectedCount,
      totalEventsCount,
      totalReadingsCount,

      integrityState,

      signalSummaries
    };
  }
}
