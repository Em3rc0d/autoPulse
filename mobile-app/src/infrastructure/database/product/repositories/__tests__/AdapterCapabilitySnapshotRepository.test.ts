import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as path from 'path';
import * as schema from '../../schema';
import { AdapterCapabilitySnapshotRepository } from '../adapter-capability-snapshot.repository';


describe('AdapterCapabilitySnapshotRepository', () => {
  it('appends observations and returns the latest without overwriting history', async () => {
    const dbName = `autopulse_adapter_capability_${Date.now()}.db`;
    const client = createClient({ url: `file:${dbName}` });
    await client.execute('PRAGMA foreign_keys = ON;');

    const db = drizzle(client, { schema });
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, '../../migrations'),
    });

    const now = Date.now();
    await db.insert(schema.workspaces).values({
      id: 'ws-r4',
      name: 'R4 Test',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.obdAdapterInstances).values({
      id: 'adapter-r4',
      workspaceId: 'ws-r4',
      alias: 'Generic BLE',
      platformDeviceId: 'ble-r4',
      trustState: 'PROBED',
      firstSeen: now,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    });

    const repo = new AdapterCapabilitySnapshotRepository(db as any);

    const first = await repo.append({
      workspaceId: 'ws-r4',
      adapterInstanceId: 'adapter-r4',
      observedAt: now,
      transportType: 'BLE',
      profileMatch: 'NO_PROFILE_MATCH',
      compatibilityGrade: 'COMPATIBLE',
      compatibilityReasons: ['GENERIC_BEHAVIOR_VERIFIED'],
      writeCharacteristic: 'write-1',
      receiveCharacteristic: 'notify-1',
      writeMode: 'WITH_RESPONSE',
      receiveMode: 'NOTIFY',
      commandUsed: 'ATI',
      sanitizedResponse: 'ELM327 v1.5',
      latencyMs: 110,
      echoDetected: false,
      promptDetected: true,
      timedOut: false,
      disconnectObserved: false,
    });

    const second = await repo.append({
      workspaceId: 'ws-r4',
      adapterInstanceId: 'adapter-r4',
      observedAt: now + 1000,
      transportType: 'BLE',
      profileMatch: 'NO_PROFILE_MATCH',
      compatibilityGrade: 'DEGRADED',
      compatibilityReasons: ['PROMPT_NOT_OBSERVED'],
      writeCharacteristic: 'write-1',
      receiveCharacteristic: 'notify-1',
      writeMode: 'WITH_RESPONSE',
      receiveMode: 'NOTIFY',
      commandUsed: 'ATI',
      sanitizedResponse: 'ELM327 v1.5',
      latencyMs: 2100,
      echoDetected: false,
      promptDetected: false,
      timedOut: true,
      disconnectObserved: false,
    });

    expect(first.id).not.toBe(second.id);

    const latest = await repo.latestForAdapter('ws-r4', 'adapter-r4');
    expect(latest?.id).toBe(second.id);
    expect(latest?.compatibilityGrade).toBe('DEGRADED');
    expect(JSON.parse(latest?.compatibilityReasonsJson || '[]')).toEqual(['PROMPT_NOT_OBSERVED']);

    const rows = await client.execute({
      sql: 'SELECT id, compatibility_grade FROM obd_adapter_capability_snapshots WHERE adapter_instance_id = ? ORDER BY observed_at ASC',
      args: ['adapter-r4'],
    });
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].compatibility_grade).toBe('COMPATIBLE');
    expect(rows.rows[1].compatibility_grade).toBe('DEGRADED');

    client.close();
  });
});
