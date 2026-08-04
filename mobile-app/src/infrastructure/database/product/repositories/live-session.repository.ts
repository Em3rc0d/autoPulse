import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { eq, and, sql, desc } from 'drizzle-orm';
import * as schema from '../schema';
import { liveSessions, liveSessionEvents } from '../schema/live';
import { ProductIdGenerator } from '../uuidv7';

type Db = ExpoSQLiteDatabase<typeof schema>;

export class LiveSessionRepository {
  constructor(private db: Db) {}

  /**
   * Helper to log an event for the session.
   * Assumes it's being run inside a transaction.
   */
  private async appendEvent(
    tx: any,
    sessionId: string,
    sequence: number,
    eventType: string,
    source: string,
    severity: string,
    detailsSchemaVersion: string,
    detailsJson: string | null = null,
    sessionOffsetMs: number = 0
  ) {
    await tx.insert(liveSessionEvents).values({
      id: ProductIdGenerator.generate(),
      sessionId,
      eventSequence: sequence,
      eventType,
      source,
      severity,
      timestampMs: Date.now(),
      sessionOffsetMs,
      detailsSchemaVersion,
      detailsJson,
      createdAt: Date.now()
    });
  }

  private async nextEventSequence(tx: any, sessionId: string): Promise<number> {
    const result = await tx
      .select({ max: sql<number>`COALESCE(MAX(${liveSessionEvents.eventSequence}), -1)` })
      .from(liveSessionEvents)
      .where(eq(liveSessionEvents.sessionId, sessionId));

    return Number(result[0]?.max ?? -1) + 1;
  }

  async recoverOrphanedSessions(workspaceId: string) {
    return await this.db.transaction(async (tx) => {
      const orphaned = await tx.select().from(schema.liveSessions).where(
        and(
          eq(schema.liveSessions.workspaceId, workspaceId),
          sql`${schema.liveSessions.status} IN ('CREATED', 'PREPARING', 'ACTIVE', 'STOPPING')`
        )
      );

      for (const session of orphaned) {
        // Reconciliation
        const aggResult = await tx
          .select({
             blocks: sql<number>`COUNT(*)`,
             events: sql<number>`COALESCE(SUM(event_count), 0)`,
             readings: sql<number>`COALESCE(SUM(reading_count), 0)`,
             maxSeq: sql<number>`COALESCE(MAX(window_index), -1)`
          })
          .from(schema.telemetryBlocks)
          .where(eq(schema.telemetryBlocks.sessionId, session.id));

        const stats = aggResult[0] || { blocks: 0, events: 0, readings: 0, maxSeq: -1 };

        await tx.update(schema.liveSessions)
          .set({
             status: 'INTERRUPTED',
             stopReason: 'UNEXPECTED_APP_TERMINATION',
             totalBlocks: stats.blocks,
             totalEvents: stats.events,
             totalReadings: stats.readings,
             lastSequenceNumber: stats.maxSeq
          } as any)
          .where(eq(schema.liveSessions.id, session.id));

        const seq = await this.nextEventSequence(tx, session.id);

        await this.appendEvent(tx, session.id, seq, 'SESSION_RECOVERED_AS_INTERRUPTED', 'SYSTEM', 'WARNING', '1.0', JSON.stringify({ reason: 'UNEXPECTED_APP_TERMINATION' }));
      }

      return orphaned.length;
    });
  }

  async getSessionById(workspaceId: string, sessionId: string) {
    return await this.db.query.liveSessions.findFirst({
      where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
    });
  }

  async getSessionsForVehicle(workspaceId: string, vehicleId: string) {
    return await this.db.query.liveSessions.findMany({
      where: and(eq(liveSessions.vehicleId, vehicleId), eq(liveSessions.workspaceId, workspaceId)),
      orderBy: [desc(liveSessions.startedAt)],
      limit: 50 // Limit for recent history
    });
  }

  async createSession(workspaceId: string, vehicleId: string, operatorId: string, adapterInstanceId: string) {
    return await this.db.transaction(async (tx) => {
      const sessionId = ProductIdGenerator.generate();
      const now = Date.now();

      await tx.insert(liveSessions).values({
        id: sessionId,
        workspaceId,
        vehicleId,
        operatorId,
        adapterInstanceId,
        status: 'CREATED',
        format: 'BINARY',
        formatVersion: '2.0',
        codec: 'BINARY_OBD2_V2',
        chunkDurationMs: 5000,
        dictionaryVersion: '1.0',
        createdAt: now
      });

      await this.appendEvent(tx, sessionId, 0, 'SESSION_CREATED', 'SYSTEM', 'INFO', '1.0');

      return sessionId;
    });
  }

  async beginPreparation(workspaceId: string, sessionId: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');
      if (session.status !== 'CREATED') throw new Error(`Invalid transition: ${session.status} -> PREPARING`);

      await tx.update(liveSessions)
        .set({ status: 'PREPARING' })
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      await this.appendEvent(tx, sessionId, seq, 'SESSION_PREPARING', 'SYSTEM', 'INFO', '1.0');
    });
  }

  async attachCapabilitySnapshot(
    workspaceId: string,
    sessionId: string,
    snapshotId: string,
    adapterProfileVersion: string,
    protocolCode: string,
    transportType: string
  ) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');
      if (session.status !== 'PREPARING') throw new Error(`Cannot attach capabilities in state ${session.status}`);

      await tx.update(liveSessions)
        .set({
          capabilitySnapshotId: snapshotId,
          adapterProfileVersion,
          protocolCode,
          transportType
        } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      await this.appendEvent(tx, sessionId, seq, 'CAPABILITY_ATTACHED', 'SYSTEM', 'INFO', '1.0', JSON.stringify({ snapshotId, protocolCode }));
    });
  }

  async attachSignalSnapshots(workspaceId: string, sessionId: string, signals: Array<{
    signalDefinitionId: string;
    parameterDefinitionId: string;
    service: number;
    pid: number;
    numericType: string;
    scale: number;
    offset: number;
    precision: number;
    decoderKey: string;
    decoderVersion: string;
    origin: string;
    priority: string;
    targetPeriodMs: number;
    supportState: string;
    localTargetIndex: number;
    localSignalIndex: number;
  }>) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');

      if (signals.length > 0) {
        const now = Date.now();
        await tx.insert(schema.liveSessionSignalSnapshots).values(
          signals.map(s => ({
            id: ProductIdGenerator.generate(),
            sessionId,
            ...s,
            createdAt: now
          }))
        );
      }
    });
  }

  async activateSession(workspaceId: string, sessionId: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');
      if (session.status !== 'PREPARING') throw new Error(`Invalid transition: ${session.status} -> ACTIVE`);
      if (!session.capabilitySnapshotId) throw new Error('Cannot activate session without a capability snapshot');
      if (!session.protocolCode) throw new Error('Cannot activate session without a detected protocol');

      const now = Date.now();

      await tx.update(liveSessions)
        .set({ status: 'ACTIVE', startedAt: now } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      await this.appendEvent(tx, sessionId, seq, 'SESSION_ACTIVATED', 'SYSTEM', 'INFO', '1.0');
    });
  }

  async requestStop(workspaceId: string, sessionId: string, reason: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');

      // If already stopping or completed, do nothing
      if (session.status === 'STOPPING' || session.status === 'COMPLETED') {
        return;
      }

      if (session.status !== 'ACTIVE') throw new Error(`Invalid transition: ${session.status} -> STOPPING`);

      await tx.update(liveSessions)
        .set({ status: 'STOPPING', stopReason: reason } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      await this.appendEvent(tx, sessionId, seq, 'SESSION_STOP_REQUESTED', 'SYSTEM', 'INFO', '1.0', JSON.stringify({ reason }), session.startedAt ? Date.now() - session.startedAt : 0);
    });
  }

  async completeSession(workspaceId: string, sessionId: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');

      // If already completed, do nothing
      if (session.status === 'COMPLETED') {
        return;
      }

      if (session.status !== 'STOPPING' && session.status !== 'ACTIVE') {
        throw new Error(`Invalid transition: ${session.status} -> COMPLETED`);
      }

      const now = Date.now();

      await tx.update(liveSessions)
        .set({ status: 'COMPLETED', endedAt: now, completedAt: now } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      await this.appendEvent(tx, sessionId, seq, 'SESSION_COMPLETED', 'SYSTEM', 'INFO', '1.0', null, session.startedAt ? now - session.startedAt : 0);
    });
  }

  async interruptSession(workspaceId: string, sessionId: string, failureCode: string) {
    try {
      return await this.db.transaction(async (tx) => {
        const session = await tx.query.liveSessions.findFirst({
          where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
        });

        if (!session) throw new Error('Session not found');

        // If already interrupted, do nothing
        if (session.status === 'INTERRUPTED') {
          return;
        }

        if (session.status !== 'ACTIVE' && session.status !== 'PREPARING') {
          throw new Error(`Invalid transition: ${session.status} -> INTERRUPTED`);
        }

        const now = Date.now();

        await tx.update(liveSessions)
          .set({ status: 'INTERRUPTED', failureCode, endedAt: now } as any)
          .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

        const seq = await this.nextEventSequence(tx, sessionId);

        await this.appendEvent(tx, sessionId, seq, 'SESSION_INTERRUPTED', 'SYSTEM', 'WARNING', '1.0', JSON.stringify({ failureCode }), session.startedAt ? now - session.startedAt : 0);
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('UNIQUE') || err.message.includes('unique'))) {
        console.log('[live-session.repository] Ignored concurrent unique constraint error in interruptSession.');
        return;
      }
      throw err;
    }
  }

  async markRecoverable(workspaceId: string, sessionId: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');
      if (session.status !== 'INTERRUPTED') throw new Error(`Invalid transition: ${session.status} -> RECOVERABLE`);

      await tx.update(liveSessions)
        .set({ status: 'RECOVERABLE' } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      const sessionOffset = session.endedAt && session.startedAt ? session.endedAt - session.startedAt : 0;
      await this.appendEvent(tx, sessionId, seq, 'SESSION_RECOVERABLE', 'SYSTEM', 'INFO', '1.0', null, sessionOffset);
    });
  }

  async completeRecoveredSession(workspaceId: string, sessionId: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');
      if (session.status !== 'RECOVERABLE') throw new Error(`Invalid transition: ${session.status} -> COMPLETED`);

      const now = Date.now();

      await tx.update(liveSessions)
        .set({ status: 'COMPLETED', recoveredAt: now, completedAt: now } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      const sessionOffset = session.endedAt && session.startedAt ? session.endedAt - session.startedAt : 0;
      await this.appendEvent(tx, sessionId, seq, 'SESSION_RECOVERY_COMPLETED', 'SYSTEM', 'INFO', '1.0', null, sessionOffset);
    });
  }

  async failSession(workspaceId: string, sessionId: string, failureCode: string) {
    return await this.db.transaction(async (tx) => {
      const session = await tx.query.liveSessions.findFirst({
        where: and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId))
      });

      if (!session) throw new Error('Session not found');
      if (session.status === 'COMPLETED') throw new Error('Cannot fail a completed session');

      const now = Date.now();

      await tx.update(liveSessions)
        .set({ status: 'FAILED', failureCode, endedAt: session.endedAt || now } as any)
        .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.workspaceId, workspaceId)));

      const seq = await this.nextEventSequence(tx, sessionId);

      const sessionOffset = session.endedAt && session.startedAt ? session.endedAt - session.startedAt : (session.startedAt ? now - session.startedAt : 0);
      await this.appendEvent(tx, sessionId, seq, 'SESSION_FAILED', 'SYSTEM', 'ERROR', '1.0', JSON.stringify({ failureCode }), sessionOffset);
    });
  }
}
