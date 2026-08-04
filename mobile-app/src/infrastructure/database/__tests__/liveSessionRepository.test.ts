import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, Client } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';
import fs from 'fs';
import * as schema from '../product/schema';
import { LiveSessionRepository } from '../product/repositories/live-session.repository';
import { eq } from 'drizzle-orm';

let mockId = 0;
jest.mock('../product/uuidv7', () => ({
  ProductIdGenerator: {
    generate: () => 'mock-uuid-v7-' + (++mockId)
  }
}));

const TEST_DB_PATH = path.join(__dirname, `test_autopulse_live_session_${process.pid}_${Date.now()}.db`);

function tryUnlinkTestDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch (error: any) {
    if (error?.code !== 'EBUSY') {
      throw error;
    }
  }
}

describe('LiveSessionRepository', () => {
  let client: Client;
  let db: LibSQLDatabase<typeof schema>;
  let repo: LiveSessionRepository;

  beforeAll(async () => {
    tryUnlinkTestDb();
    client = createClient({ url: `file:${TEST_DB_PATH}` });
    db = drizzle(client, { schema });

    // For testing, ExpoSQLiteDatabase and LibSQLDatabase have similar APIs for what the repo uses
    repo = new LiveSessionRepository(db as any);

    const migrationsFolder = path.join(__dirname, '../product/migrations');
    await migrate(db, { migrationsFolder });

    await client.execute('PRAGMA foreign_keys = ON;');

    // Setup base tenant data
    await db.insert(schema.workspaces).values({ id: 'WS_1', name: 'Workspace 1', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.workspaces).values({ id: 'WS_2', name: 'Workspace 2', createdAt: 1, updatedAt: 1 });

    await db.insert(schema.operators).values({ id: 'OP_1', workspaceId: 'WS_1', name: 'Op 1', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.vehicles).values({ id: 'VEH_1', workspaceId: 'WS_1', alias: 'Veh 1', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.obdAdapterModels).values({ id: 'MOD_1', modelName: 'Mod 1', transportFamily: 'BLE', createdAt: 1 });
    await db.insert(schema.obdAdapterInstances).values({ id: 'ADP_1', workspaceId: 'WS_1', platformDeviceId: 'MAC1', firstSeen: 1, lastSeen: 1, trustState: 'TRUSTED', createdAt: 1, updatedAt: 1 });

    await db.insert(schema.vehicleCapabilitySnapshots).values({
      id: 'SNAP_1', workspaceId: 'WS_1', vehicleId: 'VEH_1', adapterInstanceId: 'ADP_1',
      compatibilityProfileVersion: '1.0', discoveredAt: 1, protocolCode: '6',
      decoderCatalogVersion: '1.0', discoveryStatus: 'COMPLETED', rawDiscoveryHash: 'hash', createdAt: 1
    });
  });

  afterAll(() => {
    client.close();
    tryUnlinkTestDb();
  });

  let activeSessionId: string;

  it('createSession creates a session in CREATED state and logs an event', async () => {
    activeSessionId = await repo.createSession('WS_1', 'VEH_1', 'OP_1', 'ADP_1');
    expect(activeSessionId).toBeDefined();

    const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, activeSessionId) });
    expect(session).toBeDefined();
    expect(session?.status).toBe('CREATED');
    expect(session?.formatVersion).toBe('3.0');
    expect(session?.codec).toBe('BINARY_OBD2_V3');

    const events = await db.query.liveSessionEvents.findMany({ where: eq(schema.liveSessionEvents.sessionId, activeSessionId) });
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('SESSION_CREATED');
  });

  it('beginPreparation transitions to PREPARING', async () => {
    await repo.beginPreparation('WS_1', activeSessionId);

    const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, activeSessionId) });
    expect(session?.status).toBe('PREPARING');

    const events = await db.query.liveSessionEvents.findMany({ where: eq(schema.liveSessionEvents.sessionId, activeSessionId) });
    expect(events.length).toBe(2);
    expect(events[1].eventType).toBe('SESSION_PREPARING');
  });

  it('attachCapabilitySnapshot links snapshot and updates profile', async () => {
    await repo.attachCapabilitySnapshot('WS_1', activeSessionId, 'SNAP_1', '1.0', '6', 'BLE');

    const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, activeSessionId) });
    expect(session?.capabilitySnapshotId).toBe('SNAP_1');
    expect(session?.protocolCode).toBe('6');
  });

  it('activateSession transitions to ACTIVE', async () => {
    await repo.activateSession('WS_1', activeSessionId);

    const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, activeSessionId) });
    expect(session?.status).toBe('ACTIVE');
    expect(session?.startedAt).toBeGreaterThan(0);
  });

  it('requestStop transitions to STOPPING', async () => {
    await repo.requestStop('WS_1', activeSessionId, 'USER_REQUEST');

    const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, activeSessionId) });
    expect(session?.status).toBe('STOPPING');
    expect(session?.stopReason).toBe('USER_REQUEST');
  });

  it('completeSession transitions to COMPLETED', async () => {
    await repo.completeSession('WS_1', activeSessionId);

    const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, activeSessionId) });
    expect(session?.status).toBe('COMPLETED');
    expect(session?.endedAt).toBeGreaterThan(0);
    expect(session?.completedAt).toBeGreaterThan(0);
  });

  it('fails to activate a COMPLETED session', async () => {
    await expect(repo.activateSession('WS_1', activeSessionId)).rejects.toThrow(/Invalid transition/);
  });

  describe('Exception flows', () => {
    let intSessionId: string;

    it('interruptSession and recovery', async () => {
      intSessionId = await repo.createSession('WS_1', 'VEH_1', 'OP_1', 'ADP_1');
      await repo.beginPreparation('WS_1', intSessionId);
      await repo.attachCapabilitySnapshot('WS_1', intSessionId, 'SNAP_1', '1.0', '6', 'BLE');
      await repo.activateSession('WS_1', intSessionId);

      // Connection drops -> INTERRUPTED
      await repo.interruptSession('WS_1', intSessionId, 'DISCONNECTED');
      let session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, intSessionId) });
      expect(session?.status).toBe('INTERRUPTED');
      expect(session?.failureCode).toBe('DISCONNECTED');

      // System marks it as recoverable
      await repo.markRecoverable('WS_1', intSessionId);
      session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, intSessionId) });
      expect(session?.status).toBe('RECOVERABLE');

      // Then it finishes recovering
      await repo.completeRecoveredSession('WS_1', intSessionId);
      session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, intSessionId) });
      expect(session?.status).toBe('COMPLETED');
    });

    it('failSession', async () => {
      const failSessionId = await repo.createSession('WS_1', 'VEH_1', 'OP_1', 'ADP_1');
      await repo.beginPreparation('WS_1', failSessionId);

      // Fails during preparation
      await repo.failSession('WS_1', failSessionId, 'ADAPTER_REJECTED');

      const session = await db.query.liveSessions.findFirst({ where: eq(schema.liveSessions.id, failSessionId) });
      expect(session?.status).toBe('FAILED');
    });

    it('rejects cross-workspace access', async () => {
      const sId = await repo.createSession('WS_1', 'VEH_1', 'OP_1', 'ADP_1');
      // Try to prepare from WS_2
      await expect(repo.beginPreparation('WS_2', sId)).rejects.toThrow(/Session not found/);
    });
  });
});
