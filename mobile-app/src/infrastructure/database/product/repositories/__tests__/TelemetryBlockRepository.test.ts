import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient, Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';
import fs from 'fs';
import * as schema from '../../schema';
import { TelemetryBlockRepository } from '../TelemetryBlockRepository';
import { EncodedTelemetryBlock } from '../../../../../domain/telemetry/models/EncodedTelemetryBlock';

const TEST_DB_PATH = path.join(__dirname, 'test_repository.db');

describe('PR-LIVE-05D: TelemetryBlockRepository', () => {
  let client: Client;
  let db: LibSQLDatabase<typeof schema>;
  let repository: TelemetryBlockRepository;

  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    client = createClient({ url: `file:${TEST_DB_PATH}` });
    db = drizzle(client, { schema });

    // Applies migrations
    const migrationsFolder = path.join(__dirname, '../../migrations');
    await migrate(db, { migrationsFolder });

    repository = new TelemetryBlockRepository(db);

    // Seed test data
    await db.insert(schema.workspaces).values({ id: 'WS_1', name: 'WS 1', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.workspaces).values({ id: 'WS_2', name: 'WS 2', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.vehicles).values({ id: 'V_1', workspaceId: 'WS_1', alias: 'Veh', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.operators).values({ id: 'OP_1', workspaceId: 'WS_1', name: 'Op', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.obdAdapterModels).values({ id: 'MOD_1', modelName: 'M', transportFamily: 'BLE', createdAt: 1 });
    await db.insert(schema.obdAdapterInstances).values({ id: 'ADP_1', workspaceId: 'WS_1', platformDeviceId: 'MAC_1', firstSeen: 1, lastSeen: 1, trustState: 'TRUSTED', createdAt: 1, updatedAt: 1 });
  });

  afterAll(() => {
    client.close();
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    } catch (e) {}
  });

  beforeEach(async () => {
    // Clear sessions before each test
    await db.delete(schema.liveSessions);
    await db.delete(schema.telemetryBlocks);

    // Insert fresh session SESS_1 in WS_1
    await db.insert(schema.liveSessions).values({
      id: 'SESS_1',
      workspaceId: 'WS_1',
      vehicleId: 'V_1',
      operatorId: 'OP_1',
      adapterInstanceId: 'ADP_1',
      format: 'BINARY', formatVersion: 'V3', codec: 'NONE',
      status: 'ACTIVE', chunkDurationMs: 5000, dictionaryVersion: 'v1',
      createdAt: 1
    });
  });

  const createDummyBlock = (seq: number, payload: Uint8Array): EncodedTelemetryBlock => ({
    sessionId: 'SESS_1',
    blockSequence: seq,
    windowIndex: seq,
    startedAt: 1000,
    endedAt: 2000,
    isPartial: false,
    formatId: 'BINARY_OBD2_V3',
    formatVersion: 3,
    codecImplementationVersion: '1.0.0',
    decoderVersion: '1.0.0',
    storageType: 'BLOB',
    payload,
    payloadByteLength: payload.length,
    crcAlgorithm: 'CRC32',
    payloadCrc: (repository as any).calculateCrc32(payload),
    eventCount: 10,
    readingCount: 20,
    firstEventSequence: seq * 10,
    lastEventSequence: (seq * 10) + 9
  });

  it('Commits the first block (Seq 0) successfully and updates counters', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const block = createDummyBlock(0, payload);

    const result = await repository.commitBlock('WS_1', 'SESS_1', block);
    expect(result.success).toBe(true);
    if (result.success) expect(result.disposition).toBe('COMMITTED');

    const session = await db.select().from(schema.liveSessions).where(eq(schema.liveSessions.id, 'SESS_1')).get();
    expect(session?.lastCommittedSequence).toBe(0);
    expect(session?.totalBlocks).toBe(1);
    expect(session?.totalEvents).toBe(10);
    expect(session?.totalReadings).toBe(20);
  });

  it('Rejects Workspace Mismatch without hitting DB inserts', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const block = createDummyBlock(0, payload);

    const result = await repository.commitBlock('WS_2', 'SESS_1', block);
    expect(result.success).toBe(false);
    if (!result.success) expect((result as any).reason).toBe('WORKSPACE_MISMATCH');
  });

  it('Handles Idempotency: Duplicate identical commit returns ALREADY_COMMITTED without altering counters', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const block = createDummyBlock(0, payload);

    await repository.commitBlock('WS_1', 'SESS_1', block);
    const result2 = await repository.commitBlock('WS_1', 'SESS_1', block);

    expect(result2.success).toBe(true);
    if (result2.success) expect(result2.disposition).toBe('ALREADY_COMMITTED');

    const session = await db.select().from(schema.liveSessions).where(eq(schema.liveSessions.id, 'SESS_1')).get();
    expect(session?.totalBlocks).toBe(1); // Not incremented twice
  });

  it('Rejects Sequence Conflict if payload bytes differ', async () => {
    const payload1 = new Uint8Array([1, 2, 3]);
    const block1 = createDummyBlock(0, payload1);
    await repository.commitBlock('WS_1', 'SESS_1', block1);

    const payload2 = new Uint8Array([1, 2, 4]); // different
    const block2 = createDummyBlock(0, payload2); // same sequence

    // We must ensure the crc is calculated properly for block2
    const result = await repository.commitBlock('WS_1', 'SESS_1', block2);
    expect(result.success).toBe(false);
    if (!result.success) expect((result as any).reason).toBe('BLOCK_SEQUENCE_CONFLICT');
  });

  it('Rejects Sequence Gap', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const block = createDummyBlock(1, payload); // Should be 0 initially

    const result = await repository.commitBlock('WS_1', 'SESS_1', block);
    expect(result.success).toBe(false);
    if (!result.success) expect((result as any).reason).toBe('BLOCK_SEQUENCE_GAP');
  });

  it('Reads the block accurately with byte-perfect payload recovery', async () => {
    const payload = new Uint8Array([1, 2, 3, 255, 0, 127]);
    const block = createDummyBlock(0, payload);
    await repository.commitBlock('WS_1', 'SESS_1', block);

    const readResult = await repository.getBlock('SESS_1', 0);
    expect(readResult.status).toBe('VALID');

    if (readResult.status === 'VALID') {
      const recoveredPayload = readResult.block.payload;
      expect(recoveredPayload).not.toBe(payload); // Not referentially identical
      expect(Array.from(recoveredPayload)).toEqual(Array.from(payload)); // Byte identical
    }
  });

  it('Returns CORRUPTED if CRC is invalid in the database', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const block = createDummyBlock(0, payload);
    await repository.commitBlock('WS_1', 'SESS_1', block);

    // Manually corrupt the CRC in DB
    await db.update(schema.telemetryBlocks).set({ checksumValue: '123' }).where(eq(schema.telemetryBlocks.sessionId, 'SESS_1'));

    const readResult = await repository.getBlock('SESS_1', 0);
    expect(readResult.status).toBe('CORRUPTED');
  });
});
