import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import * as schema from '../../../infrastructure/database/product/schema';
import { TelemetryBlockRepository } from '../../../infrastructure/database/product/repositories/TelemetryBlockRepository';
import { LiveSessionRepository } from '../../../infrastructure/database/product/repositories/live-session.repository';
import { BinaryObd2V3Codec } from '../../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import type { UnencodedTelemetryBlock } from '../../../domain/telemetry/models/UnencodedTelemetryBlock';
import { RoadTestObservabilityService } from '../RoadTestObservabilityService';

const dbPath = path.join(__dirname, 'road_test_sqlite_integration.db');
const codec = new BinaryObd2V3Codec();

describe('ROAD TEST-001 migrated SQLite → committed V3 → readonly metrics', () => {
  let client: Client;
  let db: LibSQLDatabase<typeof schema>;
  let repo: TelemetryBlockRepository;
  let observable: RoadTestObservabilityService;

  beforeAll(async () => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    client = createClient({ url: `file:${dbPath}` });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: path.join(__dirname, '../../../infrastructure/database/product/migrations') });
    await db.insert(schema.workspaces).values({ id: 'WS1', name: 'Study', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.vehicles).values({ id: 'V1', workspaceId: 'WS1', alias: 'Test Vehicle', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.operators).values({ id: 'OP1', workspaceId: 'WS1', name: 'Test Operator', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.obdAdapterInstances).values({
      id: 'AD1', workspaceId: 'WS1', platformDeviceId: 'PRIVATE_BLE_IDENTIFIER',
      firstSeen: 1, lastSeen: 1, trustState: 'TRUSTED', createdAt: 1, updatedAt: 1,
    });
    repo = new TelemetryBlockRepository(db);
    observable = new RoadTestObservabilityService(new LiveSessionRepository(db as any), repo, codec);
  });

  afterAll(() => {
    client.close();
    try { fs.unlinkSync(dbPath); } catch { /* SQLite test data cleanup */ }
  });

  beforeEach(async () => {
    await db.delete(schema.telemetryBlocks);
    await db.delete(schema.liveSessions);
    await db.insert(schema.liveSessions).values({
      id:'S1', workspaceId:'WS1', vehicleId:'V1', operatorId:'OP1',
      adapterInstanceId:'AD1', format:'BINARY', formatVersion:'V3',
      codec:'NONE', status:'STOPPING', chunkDurationMs:5000,
      dictionaryVersion:'v1', createdAt:1000,
    });
    const block: UnencodedTelemetryBlock = {
      sessionId:'S1', blockSequence:0, windowIndex:0, startedAt:1000, endedAt:2000,
      isPartial:true, eventCount:1, readingCount:1,
      firstEventSequence:1, lastEventSequence:1,
      events:[{
        sessionId:'S1', sequenceNumber:1, requestId:'SECRET_REQ',
        command:'010D', commandFamily:'OBD_MODE_01',
        requestedAt:1100, completedAt:1200, completionReason:'PROMPT_RECEIVED',
        latencyMs:100, rawFragments:[{receivedAt:1150,decodedText:'PRIVATE_ELM_RAW'}],
        rawText:'PRIVATE_ELM_RAW',
        frames:[], negativeResponses:[], status:'SUCCESS', warnings:[],
        decodedReadings:[{
          signalId:'SPEED', service:'01', pid:'0D', value:0, unit:'km/h',
          rawBytes:[0], origin:'OBD2', quality:'GOOD', sourceEcu:'7E8', observedAt:1200,
        }],
      }],
    };
    const result = await repo.commitBlock('WS1', 'S1', codec.encode(block));
    expect(result).toMatchObject({success:true,disposition:'COMMITTED'});
    await db.update(schema.liveSessions).set({
      status:'COMPLETED', stopReason:'USER_INITIATED', endedAt:2000,
    }).where(eq(schema.liveSessions.id,'S1'));
  });

  it('uses persisted CRC-verified blocks to report a legitimate zero speed, not missing evidence', async () => {
    const report = await observable.analyze('WS1','S1');
    expect(report.metrics.trust).toBe('COMPLETE');
    expect(report.integrity).toMatchObject({
      expectedBlocks:1,foundBlocks:1,storedEvents:1,decodedEvents:1,
      storedReadings:1,decodedReadings:1,validDecodedBlocks:1,
    });
    const speed=report.metrics.perPid.find(p=>p.requestId==='010D')!;
    expect(speed.validResponses).toBe(1);
    expect(speed.responseLatencyMs.p95).toBe(100);
    expect(report.metrics.safeEvents[0].values[0].value).toBe(0);
    const serialized=JSON.stringify(report);
    for(const privateValue of ['PRIVATE_ELM_RAW','PRIVATE_BLE_IDENTIFIER','SECRET_REQ','Test Vehicle']) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('corrupted persisted CRC marks metrics degraded rather than reporting valid speed', async () => {
    await db.update(schema.telemetryBlocks).set({checksumValue:'0'})
      .where(eq(schema.telemetryBlocks.sessionId,'S1'));
    const report=await observable.analyze('WS1','S1');
    expect(report.metrics.trust).toBe('DEGRADED');
    expect(report.integrity.issues).toContain('BLOCK_CORRUPTED');
    expect(report.metrics.perPid.find(p=>p.requestId==='010D')!.validResponses).toBe(0);
    expect(report.integrity.decodedEvents).toBe(0);
  });

  it('does not read blocks when workspace ownership does not match', async () => {
    await expect(observable.analyze('WS-OTHER','S1')).rejects.toThrow('ROAD_TEST_SESSION_NOT_FOUND');
  });
});
