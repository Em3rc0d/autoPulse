import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../../../infrastructure/database/product/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

describe('Signal Identity Boundary Integration (Gate 2.6 Hotfix)', () => {
  let dbName: string;
  let sqlite: any;
  let db: any;

  beforeAll(async () => {
    dbName = `autopulse_test_signals_${Date.now()}.db`;
    sqlite = createClient({ url: `file:${dbName}` });
    await sqlite.execute('PRAGMA foreign_keys = OFF;');
    db = drizzle(sqlite, { schema });
    
    const realMigrationsFolder = path.resolve(__dirname, '../../../infrastructure/database/product/migrations');
    await migrate(db, { migrationsFolder: realMigrationsFolder });

    // Seed Core Signals just like lifecycle.ts does
    const now = Date.now();
    await db.insert(schema.obdParameterDefinitions).values({
      id: '010C', namespace: 'MODE_01', service: 1, parameterIdentifier: 0x0c, technicalName: 'RPM', requestVersion: '1.0', createdAt: now
    });
    await db.insert(schema.signalDefinitions).values({
      id: '010C', parameterDefinitionId: '010C', signalKey: 'ENGINE_RPM', name: 'RPM', numericType: 'float', decoderKey: 'MODE01', decoderVersion: '1.0', scale: 1, offset: 0, precision: 0, defaultPriority: 'HIGH', createdAt: now
    });

    await db.insert(schema.obdParameterDefinitions).values({
      id: '010D', namespace: 'MODE_01', service: 1, parameterIdentifier: 0x0d, technicalName: 'Speed', requestVersion: '1.0', createdAt: now
    });
    await db.insert(schema.signalDefinitions).values({
      id: '010D', parameterDefinitionId: '010D', signalKey: 'VEHICLE_SPEED', name: 'Speed', numericType: 'integer', decoderKey: 'MODE01', decoderVersion: '1.0', scale: 1, offset: 0, precision: 0, defaultPriority: 'HIGH', createdAt: now
    });

    await db.insert(schema.obdParameterDefinitions).values({
      id: '0105', namespace: 'MODE_01', service: 1, parameterIdentifier: 0x05, technicalName: 'Coolant', requestVersion: '1.0', createdAt: now
    });
    await db.insert(schema.signalDefinitions).values({
      id: '0105', parameterDefinitionId: '0105', signalKey: 'ENGINE_COOLANT', name: 'Coolant', numericType: 'float', decoderKey: 'MODE01', decoderVersion: '1.0', scale: 1, offset: 0, precision: 0, defaultPriority: 'MEDIUM', createdAt: now
    });

    await db.insert(schema.obdParameterDefinitions).values({
      id: 'ATRV', namespace: 'ELM_AT', service: 0, parameterIdentifier: 0, technicalName: 'Adapter Voltage', requestVersion: '1.0', createdAt: now
    });
    await db.insert(schema.signalDefinitions).values({
      id: 'ATRV', parameterDefinitionId: 'ATRV', signalKey: 'ADAPTER_VOLTAGE', name: 'Voltage', numericType: 'float', decoderKey: 'AT', decoderVersion: '1.0', scale: 1, offset: 0, precision: 0, defaultPriority: 'LOW', createdAt: now
    });
  });

  afterAll(() => {
    sqlite.close();
  });

  it('correctly joins signal_definitions to resolve canonical keys (ENGINE_RPM) instead of row IDs (010C)', async () => {
    const wsId = 'ws-signal-1';
    const vId = 'v-signal-1';
    const sId = 'sess-signal-1';
    const now = Date.now();

    await db.insert(schema.workspaces).values({ id: wsId, name: 'Test', createdAt: now, updatedAt: now });
    await db.insert(schema.vehicles).values({ id: vId, workspaceId: wsId, alias: 'Car', createdAt: now, updatedAt: now });
    await db.insert(schema.liveSessions).values({
      id: sId, vehicleId: vId, workspaceId: wsId, operatorId: 'op-1', adapterInstanceId: 'ad-1',
      format: 'BINARY', formatVersion: '3.0', codec: 'BINARY_OBD2_V3', chunkDurationMs: 30000,
      dictionaryVersion: '1.0', startedAt: now, createdAt: now, status: 'ACTIVE', monitoringProfile: 'GENERAL'
    });

    // Emulate InitializationScreen inserting snapshots using the row ID ('010C')
    const snapshots = [
      { id: '1', sessionId: sId, signalDefinitionId: '010C', parameterDefinitionId: '010C', priority: 'HIGH', numericType: 'float', localTargetIndex: 0, localSignalIndex: 0, service: 1, pid: 0x0c, targetEcu: 0, scale: 1, offset: 0, precision: 0, decoderVersion: '1.0', decoderKey: 'MODE01_010C', origin: 'BITMAP', targetPeriodMs: 250, supportState: 'SUPPORTED', createdAt: now },
      { id: '2', sessionId: sId, signalDefinitionId: '010D', parameterDefinitionId: '010D', priority: 'HIGH', numericType: 'integer', localTargetIndex: 1, localSignalIndex: 1, service: 1, pid: 0x0d, targetEcu: 0, scale: 1, offset: 0, precision: 0, decoderVersion: '1.0', decoderKey: 'MODE01_010D', origin: 'BITMAP', targetPeriodMs: 250, supportState: 'SUPPORTED', createdAt: now },
      { id: '3', sessionId: sId, signalDefinitionId: '0105', parameterDefinitionId: '0105', priority: 'MEDIUM', numericType: 'float', localTargetIndex: 2, localSignalIndex: 2, service: 1, pid: 0x05, targetEcu: 0, scale: 1, offset: 0, precision: 0, decoderVersion: '1.0', decoderKey: 'MODE01_0105', origin: 'BITMAP', targetPeriodMs: 250, supportState: 'SUPPORTED', createdAt: now },
      { id: '4', sessionId: sId, signalDefinitionId: 'ATRV', parameterDefinitionId: 'ATRV', priority: 'LOW', numericType: 'float', localTargetIndex: 3, localSignalIndex: 3, service: 0, pid: 0, targetEcu: 0, scale: 1, offset: 0, precision: 0, decoderVersion: '1.0', decoderKey: 'AT', origin: 'ADAPTER', targetPeriodMs: 250, supportState: 'SUPPORTED', createdAt: now }
    ];

    for (const snap of snapshots) {
      await db.insert(schema.liveSessionSignalSnapshots).values(snap);
    }

    // Emulate the useLiveSignalTracking query using the innerJoin
    const results = await db
      .select({
        signalDefinitionId: schema.liveSessionSignalSnapshots.signalDefinitionId, // '010C'
        parameterDefinitionId: schema.liveSessionSignalSnapshots.parameterDefinitionId,
        effectiveUnit: schema.liveSessionSignalSnapshots.effectiveUnit,
        priority: schema.liveSessionSignalSnapshots.priority,
        numericType: schema.liveSessionSignalSnapshots.numericType,
        signalKey: schema.signalDefinitions.signalKey, // 'ENGINE_RPM'
      })
      .from(schema.liveSessionSignalSnapshots)
      .innerJoin(schema.signalDefinitions, eq(schema.liveSessionSignalSnapshots.signalDefinitionId, schema.signalDefinitions.id))
      .where(eq(schema.liveSessionSignalSnapshots.sessionId, sId));

    expect(results).toHaveLength(4);

    const rpmResult = results.find((r: any) => r.signalDefinitionId === '010C');
    expect(rpmResult).toBeDefined();
    expect(rpmResult.signalKey).toBe('ENGINE_RPM'); // This is the canonical key we actually need for the UI!
    
    // Simulate what the hook does: Mapping `signalDefinitionId` to `signalKey` for the UI
    const mappedForUI = results.map((r: any) => ({
      signalDefinitionId: r.signalKey, // Overwrite with canonical key
      parameterDefinitionId: r.parameterDefinitionId,
    }));

    const rpmMapped = mappedForUI.find((r: any) => r.signalDefinitionId === 'ENGINE_RPM');
    expect(rpmMapped).toBeDefined();
    expect(rpmMapped.parameterDefinitionId).toBe('010C');

    const expectedKeys = ['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'ADAPTER_VOLTAGE'];
    const actualKeys = mappedForUI.map((r: any) => r.signalDefinitionId);
    expect(actualKeys.sort()).toEqual(expectedKeys.sort());
  });
});
