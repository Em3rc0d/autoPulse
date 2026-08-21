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

function isCodecCorruption(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toUpperCase();
  return (
    message.includes('CORRUPTED') ||
    message.includes('UNSUPPORTED') ||
    message.includes('CRC') ||
    message.includes('MAGIC MISMATCH') ||
    message.includes('PAYLOAD LENGTH')
  );
}

function emptySignalSummary(signalId: string): SignalSummary {
  return {
    signalId,
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

    // Yield control initially.
    await new Promise(resolve => setTimeout(resolve, 0));

    const expectedBlocksCount = session.totalBlocks || 0;
    const foundBlocksCount = blocks.length;
    const progressDenominator = Math.max(expectedBlocksCount, foundBlocksCount, 1);

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

    const signalMap = new Map<string, SignalSummary>();
    const signalIdByCommand = new Map<string, string>();
    const pendingNoDataByCommand = new Map<string, number>();

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
      if (
        prevLastSequence !== undefined &&
        (block.firstEventSequence > prevLastSequence + 1 || block.firstEventSequence <= prevLastSequence)
      ) {
        gapsDetectedCount++;
      }
      prevWindowIndex = block.windowIndex;
      prevLastSequence = block.lastEventSequence;

      try {
        const decoded = this.codec.decode(block.payload, block);
        completeBlocksCount++;
        if (block.isPartial) {
          partialBlocksCount++;
        }

        for (const event of decoded.events) {
          totalEventsCount++;
          const command = typeof event.command === 'string' ? event.command : undefined;

          if (event.status === 'NO_DATA' && command) {
            const knownSignalId = signalIdByCommand.get(command);
            if (knownSignalId) {
              const summary = signalMap.get(knownSignalId) || emptySignalSummary(knownSignalId);
              signalMap.set(knownSignalId, {
                ...summary,
                noDataCount: summary.noDataCount + 1
              });
            } else {
              pendingNoDataByCommand.set(command, (pendingNoDataByCommand.get(command) || 0) + 1);
            }
          }

          if (command && event.decodedReadings.length === 1) {
            const signalId = event.decodedReadings[0].signalId;
            signalIdByCommand.set(command, signalId);
            const pendingNoData = pendingNoDataByCommand.get(command) || 0;
            if (pendingNoData > 0) {
              const summary = signalMap.get(signalId) || emptySignalSummary(signalId);
              signalMap.set(signalId, {
                ...summary,
                noDataCount: summary.noDataCount + pendingNoData
              });
              pendingNoDataByCommand.delete(command);
            }
          }

          for (const reading of event.decodedReadings) {
            totalReadingsCount++;

            const sigId = reading.signalId;
            let sigSummary = signalMap.get(sigId) || emptySignalSummary(sigId);

            if (reading.quality === 'INVALID') {
              sigSummary = { ...sigSummary, invalidCount: sigSummary.invalidCount + 1 };
            } else {
              const v = reading.value;
              sigSummary = {
                ...sigSummary,
                validReadingsCount: sigSummary.validReadingsCount + 1,
                min: sigSummary.min === null ? v : Math.min(sigSummary.min, v),
                max: sigSummary.max === null ? v : Math.max(sigSummary.max, v),
                avg: sigSummary.avg === null ? v : sigSummary.avg + v,
                firstValidAt: sigSummary.firstValidAt === null
                  ? parseUtcIsoTimestamp(new Date(reading.observedAt).toISOString())
                  : sigSummary.firstValidAt,
                lastValidAt: parseUtcIsoTimestamp(new Date(reading.observedAt).toISOString())
              };
            }
            signalMap.set(sigId, sigSummary);
          }
        }
      } catch (err) {
        const error = err as Error;
        if (isCodecCorruption(error)) {
          console.warn(`[SessionSummaryBuilder] Failed to decode block ${block.windowIndex} for session ${sessionId}:`, error);
          if (error.message.toUpperCase().includes('UNSUPPORTED')) {
            unsupportedBlocksCount++;
          } else {
            corruptedBlocksCount++;
          }
        } else {
          throw err;
        }
      }

      // Yield every 10 blocks to prevent UI starvation.
      if (i % 10 === 0) {
        onProgress?.(Math.min(1, (i + 1) / progressDenominator));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    onProgress?.(1);

    const signalSummaries: Record<string, SignalSummary> = {};
    for (const [sigId, summary] of signalMap.entries()) {
      const finalAvg = summary.validReadingsCount > 0 && summary.avg !== null
        ? summary.avg / summary.validReadingsCount
        : null;
      signalSummaries[sigId] = {
        ...summary,
        avg: finalAvg
      };
    }

    let integrityState = SessionIntegrityState.COMPLETE;
    const blockCountMismatch = expectedBlocksCount > 0 && foundBlocksCount !== expectedBlocksCount;

    if (corruptedBlocksCount > 0 || unsupportedBlocksCount > 0 || gapsDetectedCount > 0 || blockCountMismatch) {
      integrityState = SessionIntegrityState.DEGRADED;
    } else if (session.status === 'INTERRUPTED' || partialBlocksCount > 0) {
      integrityState = SessionIntegrityState.PARTIAL;
    }

    if (foundBlocksCount > 0 && corruptedBlocksCount === foundBlocksCount) {
      integrityState = SessionIntegrityState.CORRUPTED;
    } else if (foundBlocksCount === 0) {
      integrityState = SessionIntegrityState.UNAVAILABLE;
    }

    const adapterId = session.adapterInstanceId;
    const startedAt = session.startedAt !== undefined && session.startedAt !== null
      ? parseUtcIsoTimestamp(new Date(session.startedAt).toISOString())
      : parseUtcIsoTimestamp(new Date(0).toISOString());
    const endedAt = session.endedAt !== undefined && session.endedAt !== null
      ? parseUtcIsoTimestamp(new Date(session.endedAt).toISOString())
      : undefined;

    return {
      sessionId: session.id as unknown as LiveSessionId,
      vehicleId: session.vehicleId as unknown as VehicleId,
      workspaceId: workspaceId as unknown as WorkspaceId,

      acquisitionMode: adapterId === 'VIRTUAL'
        ? SessionAcquisitionMode.LAPTOP_REPLAY
        : SessionAcquisitionMode.REAL_BLE,
      adapterId,
      protocolId: session.protocolCode || undefined,

      startedAt,
      endedAt,
      durationSeconds: session.startedAt && session.endedAt
        ? Math.floor((session.endedAt - session.startedAt) / 1000)
        : undefined,
      terminationReason: session.stopReason || session.failureCode || undefined,
      isInterrupted: session.status === 'INTERRUPTED' || session.status === 'FAILED',

      expectedBlocksCount,
      foundBlocksCount,
      completeBlocksCount,
      partialBlocksCount,
      corruptedBlocksCount,
      unsupportedBlocksCount,

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
