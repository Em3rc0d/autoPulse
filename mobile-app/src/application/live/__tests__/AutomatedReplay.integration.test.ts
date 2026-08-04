import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../../../infrastructure/database/product/schema';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import { TelemetryBlockRepository } from '../../../infrastructure/database/product/repositories/TelemetryBlockRepository';
import { SessionSummaryBuilder } from '../SessionSummaryBuilder';
import { ProductIdGenerator } from '../../../infrastructure/database/product/uuidv7';
import { BinaryObd2V3Codec } from '../../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import { ObdAcquisitionEvent } from '../../../domain/telemetry/models/ObdAcquisitionEvent';
import { UnencodedTelemetryBlock } from '../../../domain/telemetry/models/UnencodedTelemetryBlock';
import { LiveSessionRepository } from '../../../infrastructure/database/product/repositories/live-session.repository';


describe('Automated Replay Integration Test (GATE-1)', () => {
  let dbName: string;
  let workspaceId: string;
  let vehicleId: string;
  let sessionId: string;
  
  beforeAll(async () => {
    dbName = `autopulse_test_replay_${Date.now()}.db`;
    const sqlite = createClient({ url: `file:${dbName}` });
    
    // 1. Prepare SQLite and schema
    await sqlite.execute('PRAGMA foreign_keys = ON;');
    await sqlite.execute('PRAGMA journal_mode = WAL;');
    const db = drizzle(sqlite, { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../infrastructure/database/product/migrations') });
    
    // Seed definitions needed for decoding
    const now = Date.now();
    await sqlite.execute({
      sql: 'INSERT OR IGNORE INTO obd_parameter_definitions (id, namespace, service, parameter_identifier, technical_name, request_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['010C', 'MODE_01', 1, 0x0c, 'Engine RPM', '1.0', now]
    });
    await sqlite.execute({
      sql: 'INSERT OR IGNORE INTO obd_parameter_definitions (id, namespace, service, parameter_identifier, technical_name, request_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['010D', 'MODE_01', 1, 0x0d, 'Vehicle speed', '1.0', now]
    });
    await sqlite.execute({
      sql: 'INSERT OR IGNORE INTO obd_parameter_definitions (id, namespace, service, parameter_identifier, technical_name, request_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['0105', 'MODE_01', 1, 0x05, 'Engine coolant temperature', '1.0', now]
    });
    await sqlite.execute({
      sql: 'INSERT OR IGNORE INTO signal_definitions (id, parameter_definition_id, signal_key, name, canonical_unit, numeric_type, decoder_key, decoder_version, scale, offset, precision, default_priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['010C', '010C', 'ENGINE_RPM', 'Engine RPM', 'RPM', 'float', 'MODE01_010C', '1.0', 1, 0, 0, 'HIGH', now]
    });
    await sqlite.execute({
      sql: 'INSERT OR IGNORE INTO signal_definitions (id, parameter_definition_id, signal_key, name, canonical_unit, numeric_type, decoder_key, decoder_version, scale, offset, precision, default_priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['010D', '010D', 'VEHICLE_SPEED', 'Vehicle speed', 'km/h', 'integer', 'MODE01_010D', '1.0', 1, 0, 0, 'HIGH', now]
    });
    await sqlite.execute({
      sql: 'INSERT OR IGNORE INTO signal_definitions (id, parameter_definition_id, signal_key, name, canonical_unit, numeric_type, decoder_key, decoder_version, scale, offset, precision, default_priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['0105', '0105', 'COOLANT_TEMP', 'Engine coolant temperature', 'C', 'float', 'MODE01_0105', '1.0', 1, 0, 1, 'MEDIUM', now]
    });

    // 2. Create entities
    workspaceId = ProductIdGenerator.generate();
    vehicleId = ProductIdGenerator.generate();
    sessionId = ProductIdGenerator.generate();

    await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Test WS', createdAt: now, updatedAt: now });
    await db.insert(schema.operators as any).values({ id: 'op-1', workspaceId, name: 'Test Op', createdAt: now, updatedAt: now });
    await db.insert(schema.vehicles).values({ id: vehicleId, workspaceId, alias: 'My Car', createdAt: now, updatedAt: now });
    await db.insert(schema.obdAdapterInstances as any).values({ id: 'ad-1', workspaceId, platformDeviceId: '00:11', firstSeen: now, lastSeen: now, trustState: 'TRUSTED', createdAt: now, updatedAt: now });
    await db.insert(schema.liveSessions as any).values({ id: sessionId, vehicleId, workspaceId, operatorId: 'op-1', adapterInstanceId: 'ad-1', format: 'BINARY', formatVersion: '3.0', codec: 'BINARY_OBD2_V3', chunkDurationMs: 30000, dictionaryVersion: '1.0', startedAt: now, createdAt: now, status: 'ACTIVE', stopReason: null });

    // 3. Build Unencoded Blocks
    const createEvent = (seq: number, delta: number, signalKey: string, value: number, status: string = 'SUCCESS', errorCategory?: string): ObdAcquisitionEvent => {
      const isNegative = errorCategory === 'NEGATIVE_RESPONSE';
      return {
        sessionId,
        sequenceNumber: seq,
        requestId: `req_${delta}`,
        requestedAt: now + delta,
        completedAt: now + delta + 10,
        command: '0100', // Dummy
        commandFamily: 'OBD_MODE_01',
        completionReason: 'PROMPT_RECEIVED',
        latencyMs: 10,
        rawFragments: [],
        rawText: '',
        frames: [],
        status: status as any,
        negativeResponses: isNegative ? [{ requestedService: '01', responseCode: '11' }] : [],
        warnings: [],
        decodedReadings: status === 'SUCCESS' ? [{
          signalId: signalKey,
          service: '01',
          pid: '00',
          value,
          unit: signalKey === 'ENGINE_RPM' ? 'RPM' : (signalKey === 'VEHICLE_SPEED' ? 'km/h' : 'C'),
          rawBytes: [],
          origin: 'OBD2',
          quality: 'GOOD',
          sourceEcu: '7E8',
          observedAt: now + delta + 10
        }] : (errorCategory === 'NO_DATA' ? [{
          signalId: signalKey,
          service: '01',
          pid: '00',
          value: 0,
          unit: '',
          rawBytes: [],
          origin: 'OBD2',
          quality: 'INVALID',
          sourceEcu: '7E8',
          observedAt: now + delta + 10
        }] : [])
      };
    };

    const block0Events = [
      createEvent(0, 0, 'ENGINE_RPM', 800),
      createEvent(1, 100, 'VEHICLE_SPEED', 0),
      createEvent(2, 200, 'COOLANT_TEMP', 80)
    ];
    
    const block1Events = [
      createEvent(3, 1000, 'ENGINE_RPM', 1200),
      createEvent(4, 1100, 'VEHICLE_SPEED', 20),
      createEvent(5, 1200, 'COOLANT_TEMP', 85),
      createEvent(6, 1300, 'VEHICLE_SPEED', 0, 'NO_DATA', 'NO_DATA'),
      createEvent(7, 1400, 'ENGINE_RPM', 0, 'NEGATIVE_RESPONSE', 'NEGATIVE_RESPONSE')
    ];
    
    const block2Events = [
      createEvent(8, 2000, 'ENGINE_RPM', 1000),
      createEvent(9, 2100, 'VEHICLE_SPEED', 0),
      createEvent(10, 2200, 'COOLANT_TEMP', 90)
    ];

    const blocksToEncode: UnencodedTelemetryBlock[] = [
      {
        sessionId,
        blockSequence: 0,
        windowIndex: 0,
        startedAt: now,
        endedAt: now + 500,
        isPartial: false,
        events: block0Events,
        eventCount: block0Events.length,
        readingCount: 3,
        firstEventSequence: 0,
        lastEventSequence: 2
      },
      {
        sessionId,
        blockSequence: 1,
        windowIndex: 1,
        startedAt: now + 1000,
        endedAt: now + 1500,
        isPartial: false,
        events: block1Events,
        eventCount: block1Events.length,
        readingCount: 3,
        firstEventSequence: 3,
        lastEventSequence: 7
      },
      {
        sessionId,
        blockSequence: 2,
        windowIndex: 2,
        startedAt: now + 2000,
        endedAt: now + 2500,
        isPartial: true, // As per Jett: "Bloque 2 — parcial por stop normal"
        events: block2Events,
        eventCount: block2Events.length,
        readingCount: 3,
        firstEventSequence: 8,
        lastEventSequence: 10
      }
    ];

    const codec = new BinaryObd2V3Codec();
    const encodedBlocks = blocksToEncode.map(b => codec.encode(b));

    const repo = new TelemetryBlockRepository(db as any);
    for (const block of encodedBlocks) {
      await repo.commitBlock(workspaceId, sessionId, block);
    }
    
    // Simulate natural stop
    await db.update(schema.liveSessions as any).set({ stopReason: 'NORMAL_STOP', status: 'COMPLETED' }).where(eq(schema.liveSessions.id, sessionId));
    
    // Close initial connection
    sqlite.close();
  });

  it('reconstructs correctly from SQLite and codec', async () => {
    const codec = new BinaryObd2V3Codec();

    // Primera Reconstrucción
    const sqlite1 = createClient({ url: `file:${dbName}` });
    const db1 = drizzle(sqlite1, { schema });
    const builder1 = new SessionSummaryBuilder(new LiveSessionRepository(db1 as any), new TelemetryBlockRepository(db1 as any), codec);
    const summary1 = await builder1.build(workspaceId, sessionId);
    sqlite1.close();

    // Segunda Reconstrucción
    const sqlite2 = createClient({ url: `file:${dbName}` });
    const db2 = drizzle(sqlite2, { schema });
    const builder2 = new SessionSummaryBuilder(new LiveSessionRepository(db2 as any), new TelemetryBlockRepository(db2 as any), codec);
    const summary2 = await builder2.build(workspaceId, sessionId);
    sqlite2.close();

    // The two must be identical
    expect(summary1).toEqual(summary2);
    
    // Check Blocks
    expect(summary1.foundBlocksCount).toBe(3);
    expect(summary1.partialBlocksCount).toBe(1);
    expect(summary1.corruptedBlocksCount).toBe(0);
    expect(summary1.unsupportedBlocksCount).toBe(0);
    expect(summary1.gapsDetectedCount).toBe(0);

    // Speed: 0 participates, NO DATA does not, NEGATIVE_RESPONSE does not
    expect(summary1.signalSummaries['VEHICLE_SPEED']).toEqual(expect.objectContaining({
      min: 0,
      max: 20,
      avg: (0 + 20 + 0) / 3, // 6.6666...
    }));
    expect(summary1.signalSummaries['VEHICLE_SPEED'].avg).toBeCloseTo(6.66666, 4);

    // RPM
    expect(summary1.signalSummaries['ENGINE_RPM']).toEqual(expect.objectContaining({
      min: 800,
      max: 1200,
      avg: 1000
    }));

    // Coolant
    expect(summary1.signalSummaries['COOLANT_TEMP']).toEqual(expect.objectContaining({
      min: 80,
      max: 90,
      avg: 85
    }));
  });
});
