import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient, Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';
import fs from 'fs';
import * as schema from '../product/schema';

// This test suite uses better-sqlite3 to run the exact SQLite constraints locally in Node.
const TEST_DB_PATH = path.join(__dirname, 'test_autopulse.db');

describe('APC-04A2: Product Foundation Preflight', () => {
  let client: Client;
  let db: LibSQLDatabase<typeof schema>;

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    client = createClient({ url: `file:${TEST_DB_PATH}` });
    db = drizzle(client, { schema });
  });

  afterAll(() => {
    client.close();
    try {
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch (e) {
      // ignore EBUSY on windows
    }
  });

  it('Applies migration from scratch', async () => {
    const migrationsFolder = path.join(__dirname, '../product/migrations');
    await migrate(db, { migrationsFolder });
  });

  it('Enforces PRAGMA foreign_keys = ON', async () => {
    // libSql by default enforces FKs in local file mode if pragmas are set, but let's just make sure.
    await client.execute('PRAGMA foreign_keys = ON;');
    const row = await client.execute('PRAGMA foreign_keys;');
    expect(row.rows[0][0]).toBe(1);
  });

  describe('Database Identity', () => {
    it('Allows inserting PRODUCT identity', async () => {
      await expect(
        db.insert(schema.databaseIdentity).values({
          databaseKind: 'PRODUCT',
          schemaGeneration: 'APC-04',
          installationId: 'test-inst',
          createdAt: Date.now()
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Tenant Boundaries & Foreign Keys', () => {
    it('Creates test workspaces', async () => {
      await db.insert(schema.workspaces).values({ id: 'WS_A', name: 'Workspace A', createdAt: 1, updatedAt: 1 });
      await db.insert(schema.workspaces).values({ id: 'WS_B', name: 'Workspace B', createdAt: 1, updatedAt: 1 });
    });

    it('Creates operators and vehicles in respective workspaces', async () => {
      await db.insert(schema.operators).values({ id: 'OP_A', workspaceId: 'WS_A', name: 'Op A', createdAt: 1, updatedAt: 1 });
      await db.insert(schema.vehicles).values({ id: 'VEH_B', workspaceId: 'WS_B', alias: 'Veh B', createdAt: 1, updatedAt: 1 });
      await db.insert(schema.vehicles).values({ id: 'VEH_A', workspaceId: 'WS_A', alias: 'Veh A', createdAt: 1, updatedAt: 1 });

      await db.insert(schema.obdAdapterModels).values({
        id: 'MOD_1', modelName: 'Test Model', transportFamily: 'BLE', createdAt: 1
      });

      await db.insert(schema.obdAdapterInstances).values({
        id: 'ADP_A', workspaceId: 'WS_A', platformDeviceId: 'MAC_1', firstSeen: 1, lastSeen: 1, trustState: 'TRUSTED', createdAt: 1, updatedAt: 1
      });
    });

    it('Rejects a session linking roots from different workspaces (Cross-tenant)', async () => {
      await expect(
        db.insert(schema.liveSessions).values({
          id: 'SESS_1',
          workspaceId: 'WS_A',
          vehicleId: 'VEH_B', // Belong to WS_B!
          operatorId: 'OP_A',
          adapterInstanceId: 'ADP_A',
          format: 'BINARY', formatVersion: 'V2', codec: 'NONE',
          status: 'CREATED', chunkDurationMs: 5000, dictionaryVersion: 'v1', createdAt: 1
        })
      ).rejects.toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('Accepts a session with matching roots in the same workspace', async () => {
      await expect(
        db.insert(schema.liveSessions).values({
          id: 'SESS_2',
          workspaceId: 'WS_A',
          vehicleId: 'VEH_A',
          operatorId: 'OP_A',
          adapterInstanceId: 'ADP_A',
          format: 'BINARY', formatVersion: 'V2', codec: 'NONE',
          status: 'CREATED', chunkDurationMs: 5000, dictionaryVersion: 'v1', createdAt: 1
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    it('Rejects duplicate platform device id in same workspace', async () => {
      await expect(
        db.insert(schema.obdAdapterInstances).values({
          id: 'ADP_2', workspaceId: 'WS_A', platformDeviceId: 'MAC_1', // MAC_1 already exists in WS_A
          firstSeen: 1, lastSeen: 1, trustState: 'TRUSTED', createdAt: 1, updatedAt: 1
        })
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });

    it('Rejects duplicate telemetry blocks for same session and sequence', async () => {
        const blockBase = {
          sessionId: 'SESS_2',
          blockStartMs: 1, blockEndMs: 2, format: 'BINARY', formatVersion: '1', codec: 'NONE',
          dictionaryVersion: '1', dictionaryHash: 'hash', eventCount: 1, readingCount: 1,
          payloadLengthBytes: 10, checksumAlgorithm: 'CRC32', checksumValue: 'ABC',
          payloadBlob: Buffer.from('1234567890'), commitState: 'COMMITTED', integrityState: 'VALID', createdAt: 1
        };

      await db.insert(schema.telemetryBlocks).values({ id: 'BLK_1', sequenceNumber: 0, ...blockBase });

      await expect(
        db.insert(schema.telemetryBlocks).values({ id: 'BLK_2', sequenceNumber: 0, ...blockBase })
      ).rejects.toThrow(/UNIQUE constraint failed/i);
    });
  });

  describe('RESTRICT Policies', () => {
    it('Prevents deleting a workspace that has active sessions/vehicles', async () => {
      await expect(
        db.delete(schema.workspaces).where(eq(schema.workspaces.id, 'WS_A'))
      ).rejects.toThrow(/FOREIGN KEY constraint failed/i);
    });
  });

  describe('Constraints and Types', () => {
    it('Rejects negative sequence numbers', async () => {
      await expect(
        db.insert(schema.telemetryBlocks).values({
          id: 'BLK_NEG', sessionId: 'SESS_2', sequenceNumber: -1,
          blockStartMs: 1, blockEndMs: 2, format: 'BINARY', formatVersion: '1', codec: 'NONE',
          dictionaryVersion: '1', dictionaryHash: 'hash', eventCount: 1, readingCount: 1,
          payloadLengthBytes: 10, checksumAlgorithm: 'CRC32', checksumValue: 'ABC',
          payloadBlob: Buffer.from('1234567890'), commitState: 'COMMITTED', integrityState: 'VALID', createdAt: 1
        })
      ).rejects.toThrow();
    });

    it('Rejects payload_blob length mismatch', async () => {
      await expect(
        db.insert(schema.telemetryBlocks).values({
          id: 'BLK_LEN', sessionId: 'SESS_2', sequenceNumber: 1,
          blockStartMs: 1, blockEndMs: 2, format: 'BINARY', formatVersion: '1', codec: 'NONE',
          dictionaryVersion: '1', dictionaryHash: 'hash', eventCount: 1, readingCount: 1,
          payloadLengthBytes: 5, checksumAlgorithm: 'NONE', checksumValue: 'ABC',
          payloadBlob: Buffer.from('1234567890'), // length is 10, but declared 5
          commitState: 'COMMITTED', integrityState: 'VALID', createdAt: 1
        })
      ).rejects.toThrow();
    });
  });

  describe('Persistence and Blob Recovery (Steps 28-35)', () => {
    it('Persists and recovers raw blobs exactly', async () => {
      const rawPayload = Buffer.from(new Uint8Array([0x01, 0x02, 0xFF, 0x00, 0xAA]));

      await db.insert(schema.telemetryBlocks).values({
        id: 'BLK_BLOB', sessionId: 'SESS_2', sequenceNumber: 1,
        blockStartMs: 100, blockEndMs: 200, format: 'BINARY', formatVersion: '1', codec: 'NONE',
        dictionaryVersion: '1', dictionaryHash: 'hash', eventCount: 2, readingCount: 2,
        payloadLengthBytes: 5, checksumAlgorithm: 'NONE', checksumValue: '0',
        payloadBlob: rawPayload, commitState: 'COMMITTED', integrityState: 'VALID', createdAt: 1
      });

      const recovered = await db.query.telemetryBlocks.findFirst({
        where: eq(schema.telemetryBlocks.id, 'BLK_BLOB')
      });

      expect(recovered?.payloadBlob).toBeDefined();
      expect(Buffer.compare(recovered!.payloadBlob as Buffer, rawPayload)).toBe(0);
    });
  });

  describe('Local App Context (Bootstrap prep)', () => {
    it('Saves the local app context pointing to the default workspace', async () => {
      await expect(
        db.insert(schema.localAppContext).values({
          installationId: 'inst-1',
          defaultWorkspaceId: 'WS_A',
          defaultOperatorId: 'OP_A',
          createdAt: 1,
          updatedAt: 1
        })
      ).resolves.not.toThrow();
    });
  });
});
