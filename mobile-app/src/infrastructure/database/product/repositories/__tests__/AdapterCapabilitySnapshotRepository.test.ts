import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as path from 'path';
import * as schema from '../../schema';
import { AdapterCapabilitySnapshotRepository } from '../adapter-capability-snapshot.repository';
import { AdapterCompatibilityGrade } from '../../../../../domain/telemetry/probe/ProbeResult';
import { AdapterCapabilitySnapshot } from '../../../../../domain/telemetry/probe/AdapterCapabilitySnapshot';

function snapshot(
  assessedAt: number,
  options: { matchedProfileId?: string; degraded?: boolean } = {},
): AdapterCapabilitySnapshot {
  const behaviorAssessment = {
    schemaVersion: '1.0' as const,
    checks: [
      {
        command: 'ATE0',
        requirement: 'PREFERRED' as const,
        outcome: options.degraded ? 'FAIL' as const : 'PASS' as const,
        sanitizedResponse: options.degraded ? '?' : 'OK',
        latencyMs: 20,
        promptObserved: true,
      },
    ],
    preferredFailures: options.degraded ? ['ATE0'] : [],
    optionalFailures: [],
    disconnectObserved: false,
    certificationReady: !options.degraded,
  };

  return {
    schemaVersion: '1.0',
    transport: 'BLE',
    deviceId: 'device-1',
    deviceName: 'Generic OBD',
    rssi: -55,
    profileMatch: options.matchedProfileId ? 'EXACT_PROFILE_MATCH' : 'NO_PROFILE_MATCH',
    matchedProfileId: options.matchedProfileId,
    compatibilityGrade: options.degraded
      ? AdapterCompatibilityGrade.DEGRADED
      : AdapterCompatibilityGrade.COMPATIBLE,
    assessedAt,
    channel: {
      writeCharacteristicUUID: 'write-1',
      receiveCharacteristicUUID: 'notify-1',
      testedCombinationCount: 2,
    },
    behavior: {
      commandUsed: 'ATI\r',
      sanitizedResponse: 'ELM327 v1.5',
      bytesWritten: 4,
      latencyMs: 42,
      echoObserved: true,
      promptObserved: true,
      assessment: behaviorAssessment,
    },
    assessment: {
      probeStage: 'FINISHED',
      connectionRetained: true,
    },
  };
}

describe('AdapterCapabilitySnapshotRepository', () => {
  it('appends evidence and returns the latest assessed snapshot with behavioral provenance', async () => {
    const dbName = `adapter_capability_${Date.now()}.db`;
    const sqlite = createClient({ url: `file:${dbName}` });
    await sqlite.execute('PRAGMA foreign_keys = ON;');
    const db = drizzle(sqlite, { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../migrations') });

    const now = Date.now();
    await db.insert(schema.workspaces).values({
      id: 'ws-1', name: 'Workspace', createdAt: now, updatedAt: now,
    });
    await db.insert(schema.obdAdapterInstances).values({
      id: 'adapter-1',
      workspaceId: 'ws-1',
      platformDeviceId: 'device-1',
      trustState: 'DISCOVERED',
      firstSeen: now,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    } as any);

    const repository = new AdapterCapabilitySnapshotRepository(db as any);
    await repository.append('ws-1', 'adapter-1', snapshot(1000));
    await repository.append('ws-1', 'adapter-1', snapshot(2000, {
      matchedProfileId: 'standard-elm327-ble',
      degraded: true,
    }));

    const latest = await repository.getLatest('ws-1', 'adapter-1');

    expect(latest).not.toBeNull();
    expect(latest?.assessedAt).toBe(2000);
    expect(latest?.compatibilityGrade).toBe(AdapterCompatibilityGrade.DEGRADED);
    expect(latest?.profileMatch).toBe('EXACT_PROFILE_MATCH');
    expect(latest?.matchedProfileId).toBe('standard-elm327-ble');
    expect(latest?.deviceId).toBe('device-1');
    expect(latest?.behavior.commandUsed).toBe('ATI\r');
    expect(latest?.behavior.assessment?.preferredFailures).toEqual(['ATE0']);
    expect(latest?.behavior.assessment?.certificationReady).toBe(false);

    sqlite.close();
  });

  it('rejects cross-workspace adapter evidence through the composite foreign key', async () => {
    const dbName = `adapter_capability_tenant_${Date.now()}.db`;
    const sqlite = createClient({ url: `file:${dbName}` });
    await sqlite.execute('PRAGMA foreign_keys = ON;');
    const db = drizzle(sqlite, { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../migrations') });

    const now = Date.now();
    await db.insert(schema.workspaces).values([
      { id: 'ws-1', name: 'Workspace 1', createdAt: now, updatedAt: now },
      { id: 'ws-2', name: 'Workspace 2', createdAt: now, updatedAt: now },
    ]);
    await db.insert(schema.obdAdapterInstances).values({
      id: 'adapter-1',
      workspaceId: 'ws-1',
      platformDeviceId: 'device-1',
      trustState: 'DISCOVERED',
      firstSeen: now,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    } as any);

    const repository = new AdapterCapabilitySnapshotRepository(db as any);

    await expect(
      repository.append('ws-2', 'adapter-1', snapshot(1000))
    ).rejects.toThrow();

    sqlite.close();
  });
});
