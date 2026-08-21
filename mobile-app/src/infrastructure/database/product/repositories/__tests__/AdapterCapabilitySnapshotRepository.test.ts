import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as path from 'path';
import * as schema from '../../schema';
import {
  AdapterCapabilitySnapshotRepository,
  ADAPTER_EVIDENCE_SCHEMA_VERSION,
} from '../adapter-capability-snapshot.repository';


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
      evidence: {
        matchedProfileId: null,
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
      },
    });

    const second = await repo.append({
      workspaceId: 'ws-r4',
      adapterInstanceId: 'adapter-r4',
      observedAt: now + 1000,
      transportType: 'BLE',
      profileMatch: 'NO_PROFILE_MATCH',
      compatibilityGrade: 'DEGRADED',
      compatibilityReasons: ['PROMPT_NOT_OBSERVED'],
      evidence: {
        matchedProfileId: null,
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
      },
    });

    expect(first.id).not.toBe(second.id);

    const latest = await repo.latestForAdapter('ws-r4', 'adapter-r4');
    expect(latest?.id).toBe(second.id);
    expect(latest?.compatibilityGrade).toBe('DEGRADED');
    expect(JSON.parse(latest?.compatibilityReasonsJson || '[]')).toEqual(['PROMPT_NOT_OBSERVED']);
    expect(latest?.evidenceSchemaVersion).toBe(ADAPTER_EVIDENCE_SCHEMA_VERSION);
    expect(AdapterCapabilitySnapshotRepository.parseEvidence(latest!)).toEqual(expect.objectContaining({
      promptDetected: false,
      timedOut: true,
      latencyMs: 2100,
    }));

    const rows = await client.execute({
      sql: 'SELECT id, compatibility_grade, evidence_schema_version FROM obd_adapter_capability_snapshots WHERE adapter_instance_id = ? ORDER BY observed_at ASC',
      args: ['adapter-r4'],
    });
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].compatibility_grade).toBe('COMPATIBLE');
    expect(rows.rows[1].compatibility_grade).toBe('DEGRADED');
    expect(rows.rows[0].evidence_schema_version).toBe(ADAPTER_EVIDENCE_SCHEMA_VERSION);

    client.close();
  });

  it('refuses to persist a probe without a canonical assessment', async () => {
    const repo = new AdapterCapabilitySnapshotRepository({} as any);
    await expect(repo.appendProbeResult('ws-r4', 'adapter-r4', {
      verdict: 'SUPPORTED' as any,
      probeStage: 'FINISHED',
      profileMatch: 'NO_PROFILE_MATCH',
      connectionRetained: true,
      testedCombinationCount: 1,
      startedAt: 1,
      finishedAt: 2,
      deviceId: 'adapter-r4',
      deviceName: 'Generic',
      rssi: -40,
    })).rejects.toThrow('ADAPTER_COMPATIBILITY_ASSESSMENT_MISSING');
  });
});
