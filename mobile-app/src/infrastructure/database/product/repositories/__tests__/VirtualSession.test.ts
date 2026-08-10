import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, Client } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';
import fs from 'fs';
import * as schema from '../../schema';
import { LiveSessionRepository } from '../live-session.repository';
import { CapabilitySnapshotRepository, ECUInput, ParameterInput } from '../capability-snapshot.repository';
import { eq } from 'drizzle-orm';

let mockId = 0;
jest.mock('../../uuidv7', () => ({
  ProductIdGenerator: {
    generate: () => 'mock-uuid-v7-' + (++mockId)
  }
}));

const TEST_DB_PATH = path.join(__dirname, `test_autopulse_virtual_${process.pid}_${Date.now()}.db`);

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

describe('Virtual Session E2E', () => {
  let client: Client;
  let db: LibSQLDatabase<typeof schema>;

  beforeAll(async () => {
    tryUnlinkTestDb();
    client = createClient({ url: `file:${TEST_DB_PATH}` });
    db = drizzle(client, { schema });

    const migrationsFolder = path.join(__dirname, '../../migrations');
    await migrate(db, { migrationsFolder });

    await client.execute('PRAGMA foreign_keys = ON;');
  });

  afterAll(() => {
    client.close();
    tryUnlinkTestDb();
  });

  it('should successfully complete the virtual session lifecycle', async () => {
    const workspaceId = 'WS_VIRTUAL';
    const operatorId = 'OP_VIRTUAL';

    await db.insert(schema.workspaces).values({ id: workspaceId, name: 'Workspace', createdAt: 1, updatedAt: 1 });
    await db.insert(schema.operators).values({ id: operatorId, workspaceId, name: 'Op', createdAt: 1, updatedAt: 1 });

    // Seed vehicle
    await db.insert(schema.vehicles).values({
      id: 'vehicle-1',
      workspaceId,
      alias: 'Test Vehicle',
      createdAt: 1,
      updatedAt: 1
    });

    // Seed virtual adapter infra
    await db.insert(schema.obdAdapterModels).values({
      id: 'model-virtual',
      manufacturer: 'AutoPulse',
      modelName: 'Virtual Adapter',
      transportFamily: 'VIRTUAL',
      createdAt: 1
    } as any);

    await db.insert(schema.obdAdapterInstances).values({
      id: 'virtual-adapter',
      workspaceId,
      adapterModelId: 'model-virtual',
      alias: 'Virtual Device',
      platformDeviceId: 'virtual:device',
      firstSeen: 1,
      lastSeen: 1,
      trustState: 'TRUSTED',
      createdAt: 1,
      updatedAt: 1
    } as any);

    // Seed definitions
    await db.insert(schema.obdParameterDefinitions).values({
      id: '010C', namespace: 'OBD2', service: 1, parameterIdentifier: 12, technicalName: 'RPM', requestVersion: '1.0', createdAt: 1
    });

    await db.insert(schema.signalDefinitions).values({
      id: '010C',
      parameterDefinitionId: '010C',
      signalKey: 'ENGINE_RPM',
      name: 'Engine RPM',
      numericType: 'float',
      decoderKey: 'MODE01_010C',
      decoderVersion: '1.0',
      defaultPriority: 'HIGH',
      createdAt: 1
    });

    // Check PRAGMA foreign_key_check
    const fkCheck = await client.execute('PRAGMA foreign_key_check;');
    expect(fkCheck.rows.length).toBe(0);

    const sessionRepo = new LiveSessionRepository(db as any);
    const capRepo = new CapabilitySnapshotRepository(db as any);

    let sessionIdForRun: string;

    try {
      sessionIdForRun = await sessionRepo.createSession(workspaceId, 'vehicle-1', operatorId, 'virtual-adapter');
    } catch (e: any) {
      console.error('Create Session Error:', e.message);
      const checks = await client.execute('PRAGMA foreign_key_check;');
      console.error('FK checks:', checks.rows);
      throw e;
    }

    await sessionRepo.beginPreparation(workspaceId, sessionIdForRun);

    const ecus: ECUInput[] = [{ address: 0, protocol: 'VIRTUAL_FIXTURE' }];
    const parameters: ParameterInput[] = [
      { ecuAddress: 0, parameterDefinitionId: '010C', supportState: 'SUPPORTED', evidenceOrigin: 'REPLAY_FIXTURE', discoveryOutcome: 'SUCCESS' }
    ];

    try {
      const capSnapshot = await capRepo.createSnapshot(
        workspaceId, 'vehicle-1', 'virtual-adapter', '1.0', 'VIRTUAL_FIXTURE', 'VIRTUAL_PREVIEW', 'COMPLETED', ecus, parameters
      );
      await sessionRepo.attachCapabilitySnapshot(workspaceId, sessionIdForRun, capSnapshot.id, '1.0', 'VIRTUAL_FIXTURE', 'VIRTUAL_PREVIEW');
    } catch (e: any) {
      console.error('Capability Error:', e.message);
      throw e;
    }

    try {
      const signals = [
        {
          signalDefinitionId: '010C', // From seed
          parameterDefinitionId: '010C',
          service: 1,
          pid: 0x0c,
          targetEcu: 0,
          effectiveUnit: 'RPM',
          numericType: 'float',
          scale: 1,
          offset: 0,
          precision: 0,
          decoderKey: 'MODE01_010C',
          decoderVersion: '1.0',
          origin: 'REPLAY_FIXTURE',
          priority: 'HIGH',
          targetPeriodMs: 250,
          supportState: 'SUPPORTED',
          localTargetIndex: 0,
          localSignalIndex: 0
        }
      ];
      await sessionRepo.attachSignalSnapshots(workspaceId, sessionIdForRun, signals);
    } catch (e: any) {
      console.error('Signal Snapshot Error:', e.message);
      const checks = await client.execute('PRAGMA foreign_key_check;');
      console.error('FK checks:', checks.rows);
      throw e;
    }

    await sessionRepo.activateSession(workspaceId, sessionIdForRun);

    const session = (await db.select().from(schema.liveSessions).where(eq(schema.liveSessions.id, sessionIdForRun)))[0];
    const finalFkCheck = await client.execute('PRAGMA foreign_key_check;');
    expect(finalFkCheck.rows.length).toBe(0);
  });
});
