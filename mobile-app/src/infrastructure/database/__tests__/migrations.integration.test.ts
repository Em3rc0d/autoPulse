import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../../../infrastructure/database/product/schema';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Migrations Integration (Gate 2.6)', () => {
  let dbName: string;
  let sqlite: any;
  let db: any;
  let tempMigrationsFolder: string;

  beforeAll(() => {
    dbName = `autopulse_test_migrations_${Date.now()}.db`;
    sqlite = createClient({ url: `file:${dbName}` });
    db = drizzle(sqlite, { schema });
    
    // Create a temporary migrations folder with only up to 0003
    tempMigrationsFolder = path.resolve(__dirname, `../../../infrastructure/database/product/temp_migrations_${Date.now()}`);
    fs.mkdirSync(tempMigrationsFolder, { recursive: true });
    
    const realMigrationsFolder = path.resolve(__dirname, '../../../infrastructure/database/product/migrations');
    const files = fs.readdirSync(realMigrationsFolder);
    
    // Copy journal and migrations up to 0003
    for (const file of files) {
      if (file === 'meta' || file.startsWith('0000') || file.startsWith('0001') || file.startsWith('0002') || file.startsWith('0003')) {
        const dest = path.join(tempMigrationsFolder, file);
        if (fs.statSync(path.join(realMigrationsFolder, file)).isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          const subfiles = fs.readdirSync(path.join(realMigrationsFolder, file));
          for (const sub of subfiles) {
            fs.copyFileSync(path.join(realMigrationsFolder, file, sub), path.join(dest, sub));
          }
          // Fix _journal.json
          const journalPath = path.join(dest, '_journal.json');
          if (fs.existsSync(journalPath)) {
            const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
            journal.entries = journal.entries.filter((e: any) => e.idx <= 3);
            fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
          }
        } else {
          fs.copyFileSync(path.join(realMigrationsFolder, file), dest);
        }
      }
    }
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(tempMigrationsFolder, { recursive: true, force: true });
  });

  it('safely applies 0004 and 0005 to an existing DB and preserves legacy sessions as GENERAL', async () => {
    // 1. Migrate up to 0003
    await migrate(db, { migrationsFolder: tempMigrationsFolder });

    const now = Date.now();
    const wsId = 'ws-mig-1';
    const vId = 'v-mig-1';
    const sId = 'sess-legacy-1';

    // 2. Insert data using raw SQL because Drizzle schema expects monitoringProfile to exist!
    await sqlite.execute('PRAGMA foreign_keys = OFF;');
    await sqlite.execute({
      sql: 'INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      args: [wsId, 'Test', now, now]
    });
    await sqlite.execute({
      sql: 'INSERT INTO vehicles (id, workspace_id, alias, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      args: [vId, wsId, 'Car', now, now]
    });
    
    // Legacy live_sessions insert (NO monitoring_profile column exists yet!)
    await sqlite.execute({
      sql: 'INSERT INTO live_sessions (id, vehicle_id, workspace_id, operator_id, adapter_instance_id, format, format_version, codec, chunk_duration_ms, dictionary_version, started_at, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [sId, vId, wsId, 'op-1', 'ad-1', 'BINARY', '3.0', 'BINARY_OBD2_V3', 30000, '1.0', now, now, 'ACTIVE']
    });

    // Verify it was inserted and has no monitoring_profile (it would crash if it did)
    const legacyRow = await sqlite.execute({
      sql: 'SELECT * FROM live_sessions WHERE id = ?', 
      args: [sId]
    });
    expect(legacyRow.rows[0].monitoring_profile).toBeUndefined();

    // 3. Run full migrations (0004 and 0005)
    const realMigrationsFolder = path.resolve(__dirname, '../../../infrastructure/database/product/migrations');
    await migrate(db, { migrationsFolder: realMigrationsFolder });

    // 4. Verify using Drizzle ORM
    const session = await db.query.liveSessions.findFirst({
      where: (ls: any, { eq }: any) => eq(ls.id, sId)
    });

    // The legacy session must now correctly report GENERAL
    expect(session).toBeDefined();
    expect(session.monitoringProfile).toBe('GENERAL');

    // 5. Verify we can insert a new session with PERFORMANCE
    await db.insert(schema.liveSessions as any).values({
      id: 'sess-new-1',
      vehicleId: vId,
      workspaceId: wsId,
      operatorId: 'op-1',
      adapterInstanceId: 'ad-1',
      format: 'BINARY',
      formatVersion: '3.0',
      codec: 'BINARY_OBD2_V3',
      chunkDurationMs: 30000,
      dictionaryVersion: '1.0',
      startedAt: now,
      createdAt: now,
      status: 'ACTIVE',
      monitoringProfile: 'PERFORMANCE'
    });

    const newSession = await db.query.liveSessions.findFirst({
      where: (ls: any, { eq }: any) => eq(ls.id, 'sess-new-1')
    });
    expect(newSession.monitoringProfile).toBe('PERFORMANCE');
  });
});
