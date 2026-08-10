import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, Client } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import * as schema from '../product/schema';
import { CapabilitySnapshotRepository, ECUInput, ParameterInput } from '../product/repositories/capability-snapshot.repository';

let mockId = 0;
jest.mock('../product/uuidv7', () => ({
  ProductIdGenerator: {
    generate: () => 'mock-uuid-v7-cap-' + (++mockId)
  }
}));

const TEST_DB_PATH = path.join(__dirname, `test_autopulse_cap_snapshot_${process.pid}_${Date.now()}.db`);

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

describe('CapabilitySnapshotRepository Integration', () => {
  let client: Client;
  let db: LibSQLDatabase<typeof schema>;
  let repo: CapabilitySnapshotRepository;
  const workspaceId = 'test-workspace-1';
  const vehicleId = 'test-vehicle-1';
  const adapterInstanceId = 'test-adapter-1';

  beforeAll(async () => {
    tryUnlinkTestDb();
    client = createClient({ url: `file:${TEST_DB_PATH}` });
    db = drizzle(client, { schema });

    repo = new CapabilitySnapshotRepository(db as any);

    const migrationsFolder = path.join(__dirname, '../product/migrations');
    await migrate(db, { migrationsFolder });

    await client.execute('PRAGMA foreign_keys = ON;');

    const now = Date.now();
    await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Workspace 1', createdAt: now, updatedAt: now });

    await db.insert(schema.vehicles).values({
      id: vehicleId,
      workspaceId,
      alias: 'Test Car',
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      createdAt: now,
      updatedAt: now
    } as any);

    await db.insert(schema.obdAdapterModels).values({
      id: 'test-model',
      manufacturer: 'AutoPulse',
      modelName: 'Test Model',
      transportFamily: 'BLE',
      createdAt: now
    } as any);

    await db.insert(schema.obdAdapterInstances).values({
      id: adapterInstanceId,
      workspaceId,
      adapterModelId: 'test-model',
      platformDeviceId: 'device-123',
      alias: 'Test Adapter',
      trustState: 'TRUSTED',
      firstSeen: now,
      lastSeen: now,
      createdAt: now,
      updatedAt: now
    } as any);

    // Seed the standard Mode 01 definitions that AutoPulse uses natively
    await db.insert(schema.obdParameterDefinitions).values([
      { id: '010C', namespace: 'MODE_01', service: 1, parameterIdentifier: 0x0c, technicalName: 'RPM', requestVersion: '1.0', createdAt: now },
      { id: '010D', namespace: 'MODE_01', service: 1, parameterIdentifier: 0x0d, technicalName: 'Speed', requestVersion: '1.0', createdAt: now },
    ]);
    
    // As implemented in lifecycle.ts, pre-seed generic Mode 01 capabilities 01-FF
    for (let i = 1; i <= 255; i++) {
      const hex = i.toString(16).padStart(2, '0').toUpperCase();
      const id = `01${hex}`;
      await db.insert(schema.obdParameterDefinitions).values({
        id, namespace: 'MODE_01', service: 1, parameterIdentifier: i, technicalName: `Unmapped Mode 01 Parameter 0x${hex}`, requestVersion: '1.0', createdAt: now
      }).onConflictDoNothing();
    }
  });

  afterAll(async () => {
    client.close();
    tryUnlinkTestDb();
  });

  it('Test A: Discovered standard PIDs are successfully persisted without FK failure, even if not mapped to signals in AutoPulse', async () => {
    // These PIDs are standard Mode 01, returned by the ECU in a 0100 bitmap
    // AutoPulse might not have a decoder for 0101 or 011C, but they should be persisted 
    // exactly as announced by the car to preserve discovery fidelity.
    const ecus: ECUInput[] = [{ address: 0, protocol: 'ISO 15765-4 (CAN 11/500)' }];
    const announcedPids = ['010C', '010D', '0101', '011C'];
    
    const parameters: ParameterInput[] = announcedPids.map(pid => ({
      ecuAddress: 0,
      parameterDefinitionId: pid,
      supportState: 'SUPPORTED',
      evidenceOrigin: 'BITMAP',
      discoveryOutcome: 'SUCCESS'
    }));

    // This should NOT throw a FOREIGN KEY constraint failed error, because our 
    // db seed successfully initialized canonical 01-FF and 09xx definitions.
    const snapshot = await repo.createSnapshot(
      workspaceId,
      vehicleId,
      adapterInstanceId,
      '1.0',
      'ISO 15765-4 (CAN 11/500)',
      'BLE',
      'COMPLETED',
      ecus,
      parameters
    );

    expect(snapshot).toBeDefined();
    expect(snapshot.id).toContain('mock-uuid-v7-cap-');

    // Verify they are really in the database
    const savedParams = await db.select().from(schema.vehicleCapabilityParameters).where(
      eq(schema.vehicleCapabilityParameters.snapshotId, snapshot.id)
    );

    expect(savedParams).toHaveLength(4);
    const savedIds = savedParams.map(p => p.parameterDefinitionId).sort();
    expect(savedIds).toEqual(['0101', '010C', '010D', '011C']);
  });

  it('Test B: Fails cleanly with FK constraint if a completely unknown garbage PID is injected', async () => {
    const ecus: ECUInput[] = [{ address: 0, protocol: 'ISO 15765-4 (CAN 11/500)' }];
    const parameters: ParameterInput[] = [
      { ecuAddress: 0, parameterDefinitionId: '010C', supportState: 'SUPPORTED', evidenceOrigin: 'BITMAP', discoveryOutcome: 'SUCCESS' },
      { ecuAddress: 0, parameterDefinitionId: 'UNKNOWN_9999', supportState: 'SUPPORTED', evidenceOrigin: 'BITMAP', discoveryOutcome: 'SUCCESS' }
    ];

    await expect(
      repo.createSnapshot(
        workspaceId,
        vehicleId,
        adapterInstanceId,
        '1.0',
        'ISO 15765-4 (CAN 11/500)',
        'BLE',
        'COMPLETED',
        ecus,
        parameters
      )
    ).rejects.toThrow(/FOREIGN KEY/); // the SQLite constraint must properly reject the entire transaction
  });
});
