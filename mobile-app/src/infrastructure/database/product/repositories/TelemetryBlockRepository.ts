import { eq, and, isNull } from 'drizzle-orm';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { liveSessions, telemetryBlocks } from '../schema/live';
import {
  ITelemetryBlockRepository,
  CommitOutcome,
  BlockReadResult
} from '../../../../domain/telemetry/repositories/TelemetryBlockRepository';
import { EncodedTelemetryBlock } from '../../../../domain/telemetry/models/EncodedTelemetryBlock';

export class TelemetryBlockRepository implements ITelemetryBlockRepository {
  constructor(private db: any) {}

  private crc32Table = new Uint32Array(256);
  private crcInitialized = false;

  private initCrc32Table() {
    if (this.crcInitialized) return;
    let c;
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      this.crc32Table[n] = c;
    }
    this.crcInitialized = true;
  }

  private calculateCrc32(buffer: Uint8Array): number {
    this.initCrc32Table();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc = this.crc32Table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  private isByteIdentical(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  async commitBlock(
    workspaceId: string,
    sessionId: string,
    encodedBlock: EncodedTelemetryBlock
  ): Promise<CommitOutcome> {
    if (encodedBlock.sessionId !== sessionId) {
      return { success: false, reason: 'SESSION_NOT_FOUND' };
    }

    if (encodedBlock.formatId !== 'BINARY_OBD2_V3') {
      return { success: false, reason: 'UNSUPPORTED_FORMAT' };
    }

    if (encodedBlock.storageType !== 'BLOB') {
      return { success: false, reason: 'INVALID_BLOCK_METADATA' };
    }

    if (!encodedBlock.payload || encodedBlock.payloadByteLength !== encodedBlock.payload.byteLength) {
      return { success: false, reason: 'INVALID_BLOCK_METADATA' };
    }

    const calculatedCrc = this.calculateCrc32(encodedBlock.payload);
    if (calculatedCrc !== encodedBlock.payloadCrc) {
      return { success: false, reason: 'INVALID_BLOCK_CRC' };
    }

    const targetSequence = encodedBlock.blockSequence;

    try {
      return await this.db.transaction(async (tx) => {
        const session = await tx.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
        if (!session) return { success: false, reason: 'SESSION_NOT_FOUND' };

        if (session.workspaceId !== workspaceId) return { success: false, reason: 'WORKSPACE_MISMATCH' };
        if (session.status !== 'ACTIVE' && session.status !== 'STOPPING') {
          return { success: false, reason: 'SESSION_NOT_RECORDABLE' };
        }

        const existing = await tx.select().from(telemetryBlocks)
          .where(and(
            eq(telemetryBlocks.sessionId, sessionId),
            eq(telemetryBlocks.sequenceNumber, targetSequence)
          )).get();

        if (existing) {
          const existingPayload = existing.payloadBlob as Uint8Array;
          if (
            existing.format === (encodedBlock.formatId.includes('BINARY') ? 'BINARY' : 'JSON') &&
            existing.formatVersion === encodedBlock.formatVersion.toString() &&
            existing.payloadLengthBytes === encodedBlock.payloadByteLength &&
            existing.checksumValue === encodedBlock.payloadCrc.toString() &&
            existing.eventCount === encodedBlock.eventCount &&
            existing.readingCount === encodedBlock.readingCount &&
            this.isByteIdentical(existingPayload, encodedBlock.payload)
          ) {
            return { success: true, disposition: 'ALREADY_COMMITTED' };
          }
          return { success: false, reason: 'BLOCK_SEQUENCE_CONFLICT' };
        }

        const expectedSeq = session.lastCommittedSequence === null ? 0 : session.lastCommittedSequence + 1;

        if (targetSequence > expectedSeq) return { success: false, reason: 'BLOCK_SEQUENCE_GAP' };
        if (targetSequence < expectedSeq) return { success: false, reason: 'REGRESSIVE_BLOCK_SEQUENCE' };

        const updateCondition = and(
          eq(liveSessions.id, sessionId),
          eq(liveSessions.workspaceId, workspaceId),
          session.lastCommittedSequence === null
            ? isNull(liveSessions.lastCommittedSequence)
            : eq(liveSessions.lastCommittedSequence, session.lastCommittedSequence)
        );

        const updateResult = await tx.update(liveSessions)
          .set({
            lastCommittedSequence: targetSequence,
            totalBlocks: session.totalBlocks + 1,
            totalEvents: session.totalEvents + encodedBlock.eventCount,
            totalReadings: session.totalReadings + encodedBlock.readingCount
          })
          .where(updateCondition).returning({ id: liveSessions.id });

        if (updateResult.length !== 1) {
          throw new Error('INTERNAL_CONCURRENT_SESSION_UPDATE');
        }

        await tx.insert(telemetryBlocks).values({
          id: `${sessionId}_b${targetSequence}`,
          sessionId: sessionId,
          workspaceId: workspaceId,
          sequenceNumber: targetSequence,
          windowIndex: encodedBlock.windowIndex,
          isPartial: encodedBlock.isPartial,
          blockStartMs: encodedBlock.startedAt,
          blockEndMs: encodedBlock.endedAt,
          format: encodedBlock.formatId.includes('BINARY') ? 'BINARY' : 'JSON',
          formatVersion: encodedBlock.formatVersion.toString(),
          codec: encodedBlock.codecImplementationVersion,
          decoderVersion: encodedBlock.decoderVersion,
          dictionaryVersion: '1.0',
          dictionaryHash: 'NONE',
          eventCount: encodedBlock.eventCount,
          readingCount: encodedBlock.readingCount,
          firstEventSequence: encodedBlock.firstEventSequence,
          lastEventSequence: encodedBlock.lastEventSequence,
          payloadLengthBytes: encodedBlock.payloadByteLength,
          checksumAlgorithm: encodedBlock.crcAlgorithm,
          checksumValue: encodedBlock.payloadCrc.toString(),
          storageType: encodedBlock.storageType,
          payloadBlob: encodedBlock.payload,
          commitState: 'COMMITTED',
          integrityState: 'VALID',
          createdAt: Date.now()
        });

        return { success: true, disposition: 'COMMITTED' };
      });
    } catch (e: any) {
      if (e.message === 'INTERNAL_CONCURRENT_SESSION_UPDATE') {
        return { success: false, reason: 'CONCURRENT_SESSION_UPDATE' };
      }
      console.error('DATABASE_WRITE_FAILED error:', e);
      return { success: false, reason: 'DATABASE_WRITE_FAILED' };
    }
  }

  async getBlock(sessionId: string, blockSequence: number): Promise<BlockReadResult> {
    const row = await this.db.select().from(telemetryBlocks)
      .where(and(
        eq(telemetryBlocks.sessionId, sessionId),
        eq(telemetryBlocks.sequenceNumber, blockSequence)
      )).get();

    if (!row) return { status: 'NOT_FOUND' };

    return this.mapRowToResult(row);
  }

  async getLastCommittedBlock(sessionId: string): Promise<BlockReadResult | null> {
    const session = await this.db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
    if (!session || session.lastCommittedSequence === null) return null;

    return this.getBlock(sessionId, session.lastCommittedSequence);
  }

  async verifyStoredBlock(sessionId: string, blockSequence: number): Promise<boolean> {
    const result = await this.getBlock(sessionId, blockSequence);
    return result.status === 'VALID';
  }

  async getAllBlocksForSession(sessionId: string): Promise<BlockReadResult[]> {
    const rows = await this.db.select().from(telemetryBlocks)
      .where(eq(telemetryBlocks.sessionId, sessionId))
      .orderBy(telemetryBlocks.windowIndex)
      .all();

    return rows.map((row: any) => this.mapRowToResult(row));
  }

  private mapRowToResult(row: any): BlockReadResult {
    const payload = row.payloadBlob as Uint8Array;

    if (payload.byteLength !== row.payloadLengthBytes) {
      return { status: 'TRUNCATED', error: new Error('Payload length mismatch') };
    }

    const calculatedCrc = this.calculateCrc32(payload);
    if (calculatedCrc.toString() !== row.checksumValue) {
      return { status: 'CORRUPTED', error: new Error('CRC mismatch') };
    }

    if (row.format !== 'BINARY') {
       return { status: 'UNSUPPORTED_FORMAT', error: new Error('Unknown format: ' + row.format) };
    }

    const formatId = row.formatVersion === '3' ? 'BINARY_OBD2_V3' : 'BINARY_OBD2_V2';

    const block: EncodedTelemetryBlock = {
      sessionId: row.sessionId,
      blockSequence: row.sequenceNumber,
      windowIndex: row.windowIndex ?? row.sequenceNumber,
      startedAt: row.blockStartMs,
      endedAt: row.blockEndMs,
      isPartial: row.isPartial ?? false,
      formatId: formatId,
      formatVersion: parseInt(row.formatVersion, 10),
      codecImplementationVersion: row.codec,
      decoderVersion: row.decoderVersion ?? '1.0.0',
      storageType: 'BLOB',
      payload: payload,
      payloadByteLength: row.payloadLengthBytes,
      crcAlgorithm: row.checksumAlgorithm,
      payloadCrc: parseInt(row.checksumValue, 10),
      eventCount: row.eventCount,
      readingCount: row.readingCount,
      firstEventSequence: row.firstEventSequence ?? 0,
      lastEventSequence: row.lastEventSequence ?? 0
    };

    return { status: 'VALID', block };
  }
}
