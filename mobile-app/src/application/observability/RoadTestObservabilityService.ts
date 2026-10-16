import type { LiveSessionRepository } from '../../infrastructure/database/product/repositories/live-session.repository';
import type { ITelemetryBlockRepository } from '../../domain/telemetry/repositories/TelemetryBlockRepository';
import type { BinaryObd2V3Codec } from '../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import type { ObdAcquisitionEvent } from '../../domain/telemetry/models/ObdAcquisitionEvent';
import { calculateRoadTestMetrics, type RoadTestMetricsResult } from './RoadTestMetrics';

const MAX_EVENTS = 25_000;
const MAX_BLOCKS = 5_000;

export interface RoadTestObservabilityReport {
  readonly schemaVersion: 1;
  readonly source: 'LOCAL_PERSISTED_BINARY_OBD2_V3';
  readonly status: 'COMPLETED' | 'INTERRUPTED';
  readonly integrity: {
    readonly expectedBlocks: number;
    readonly foundBlocks: number;
    readonly validDecodedBlocks: number;
    readonly storedEvents: number;
    readonly decodedEvents: number;
    readonly storedReadings: number;
    readonly decodedReadings: number;
    readonly issues: readonly string[];
  };
  readonly metrics: RoadTestMetricsResult;
}

/**
 * Offline and read-only. Session scoping is checked before reading blocks,
 * because the current block repository only filters by sessionId.
 * No payload, ELM raw fragments, VIN, GPS or adapter identity is exported.
 */
export class RoadTestObservabilityService {
  constructor(
    private readonly sessions: Pick<LiveSessionRepository, 'getSessionById'>,
    private readonly blocks: Pick<ITelemetryBlockRepository, 'getAllBlocksForSession'>,
    private readonly codec: Pick<BinaryObd2V3Codec, 'decode'>,
  ) {}

  async analyze(workspaceId: string, sessionId: string): Promise<RoadTestObservabilityReport> {
    if (!workspaceId?.trim() || !sessionId?.trim()) throw new Error('ROAD_TEST_IDENTITY_REQUIRED');
    const session = await this.sessions.getSessionById(workspaceId, sessionId);
    if (!session) throw new Error('ROAD_TEST_SESSION_NOT_FOUND');
    if (session.status !== 'COMPLETED' && session.status !== 'INTERRUPTED') {
      throw new Error('ROAD_TEST_ACTIVE_SESSION_FORBIDDEN');
    }
    if (session.adapterInstanceId === 'VIRTUAL') throw new Error('ROAD_TEST_VIRTUAL_SESSION_FORBIDDEN');
    if (session.totalBlocks > MAX_BLOCKS || session.totalEvents > MAX_EVENTS) {
      throw new Error('ROAD_TEST_EXPORT_LIMIT_EXCEEDED');
    }

    const readResults = await this.blocks.getAllBlocksForSession(sessionId);
    if (readResults.length > MAX_BLOCKS) throw new Error('ROAD_TEST_EXPORT_LIMIT_EXCEEDED');

    const issues = new Set<string>();
    const events: ObdAcquisitionEvent[] = [];
    const expectedBlocks = session.totalBlocks ?? 0;
    let validDecodedBlocks = 0;
    let previousBlockSequence: number | null = null;
    let previousLastEvent: number | null = null;
    let decodedReadings = 0;
    const validBlocks = readResults
      .filter((result): result is Extract<typeof result, {status:'VALID'}> => result.status === 'VALID')
      .map(result => result.block)
      .sort((a, b) => a.blockSequence - b.blockSequence);
    for (const result of readResults) {
      if (result.status !== 'VALID') issues.add(`BLOCK_${result.status}`);
    }
    if (readResults.length !== expectedBlocks) issues.add('BLOCK_COUNT_MISMATCH');
    if (session.status === 'INTERRUPTED') issues.add('SESSION_INTERRUPTED');
    if (validBlocks.length !== readResults.length) issues.add('INCOMPLETE_PERSISTED_EVIDENCE');

    for (const block of validBlocks) {
      if (previousBlockSequence !== null && block.blockSequence <= previousBlockSequence) {
        issues.add('DUPLICATE_OR_REGRESSIVE_BLOCK');
        continue;
      }
      if (previousBlockSequence === null && block.blockSequence !== 0) issues.add('BLOCK_SEQUENCE_GAP');
      if (previousBlockSequence !== null && block.blockSequence !== previousBlockSequence + 1) {
        issues.add('BLOCK_SEQUENCE_GAP');
      }
      previousBlockSequence = block.blockSequence;

      if (block.formatId !== 'BINARY_OBD2_V3' || block.formatVersion !== 3) {
        issues.add('UNSUPPORTED_BLOCK_CODEC');
        continue;
      }
      try {
        const decoded = this.codec.decode(block.payload, block);
        if (decoded.sessionId !== sessionId
          || decoded.blockSequence !== block.blockSequence
          || decoded.eventCount !== block.eventCount
          || decoded.readingCount !== block.readingCount
          || decoded.firstEventSequence !== block.firstEventSequence
          || decoded.lastEventSequence !== block.lastEventSequence) {
          issues.add('BLOCK_METADATA_MISMATCH');
        }
        if (previousLastEvent !== null && decoded.firstEventSequence !== previousLastEvent + 1) {
          issues.add('CROSS_BLOCK_EVENT_SEQUENCE_GAP_OR_OVERLAP');
        }
        previousLastEvent = decoded.lastEventSequence;
        decodedReadings += decoded.readingCount;
        events.push(...decoded.events);
        validDecodedBlocks++;
        if (events.length > MAX_EVENTS) throw new Error('ROAD_TEST_EXPORT_LIMIT_EXCEEDED');
      } catch (error) {
        if (error instanceof Error && error.message === 'ROAD_TEST_EXPORT_LIMIT_EXCEEDED') throw error;
        issues.add('BLOCK_DECODE_FAILED');
      }
      // Do not lock the UI event loop when decoding a multi-minute session.
      if (validDecodedBlocks % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    if (events.length !== (session.totalEvents ?? 0)) issues.add('SESSION_EVENT_COUNT_MISMATCH');
    if (decodedReadings !== (session.totalReadings ?? 0)) issues.add('SESSION_READING_COUNT_MISMATCH');
    const metrics = calculateRoadTestMetrics(events, [...issues]);
    return Object.freeze({
      schemaVersion: 1 as const,
      source: 'LOCAL_PERSISTED_BINARY_OBD2_V3' as const,
      status: session.status,
      integrity: Object.freeze({
        expectedBlocks,
        foundBlocks: readResults.length,
        validDecodedBlocks,
        storedEvents: session.totalEvents ?? 0,
        decodedEvents: events.length,
        storedReadings: session.totalReadings ?? 0,
        decodedReadings,
        issues: metrics.issues,
      }),
      metrics,
    });
  }
}
