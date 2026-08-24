import * as SQLite from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';
import migrations from './migrations/migrations';
import { bootstrapProductDb } from './bootstrap';
import { LiveSessionRepository } from './repositories/live-session.repository';
import {
  STANDARD_OBD_CATALOG_VERSION,
  STANDARD_OBD_TIER_1
} from '../../../domain/obd/StandardObdCatalogV1';

export type LifecycleState = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'FAILED' | 'CLOSING' | 'CLOSED';

let currentState: LifecycleState = 'UNINITIALIZED';
let initializationPromise: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;
let dbInstance: ExpoSQLiteDatabase<typeof schema> | null = null;
let sqliteDb: SQLite.SQLiteDatabase | null = null;

async function seedCoreObdDefinitions(database: SQLite.SQLiteDatabase) {
  const now = Date.now();
  const capabilityRanges = [
    ['0100', 0x00, 'Supported PIDs 01-20'],
    ['0120', 0x20, 'Supported PIDs 21-40'],
    ['0140', 0x40, 'Supported PIDs 41-60'],
    ['0160', 0x60, 'Supported PIDs 61-80'],
    ['0180', 0x80, 'Supported PIDs 81-A0'],
    ['01A0', 0xa0, 'Supported PIDs A1-C0'],
    ['01C0', 0xc0, 'Supported PIDs C1-E0']
  ] as const;

  const parameters = [
    ...capabilityRanges.map(([id, pid, technicalName]) => ({
      id, pid, technicalName, requestVersion: STANDARD_OBD_CATALOG_VERSION
    })),
    ...STANDARD_OBD_TIER_1.map(item => ({
      id: item.requestId,
      pid: Number.parseInt(item.pid, 16),
      technicalName: item.technicalName,
      requestVersion: item.catalogVersion
    }))
  ];

  for (const parameter of parameters) {
    await database.runAsync(
      `INSERT INTO obd_parameter_definitions
        (id, namespace, service, parameter_identifier, technical_name, request_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         technical_name = excluded.technical_name,
         request_version = excluded.request_version`,
      [
        parameter.id, 'MODE_01', 1, parameter.pid, parameter.technicalName,
        parameter.requestVersion, now
      ]
    );
  }

  for (const signal of STANDARD_OBD_TIER_1) {
    await database.runAsync(
      `INSERT INTO signal_definitions
        (id, parameter_definition_id, signal_key, name, canonical_unit, numeric_type,
         decoder_key, decoder_version, scale, offset, precision, default_priority, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         signal_key = excluded.signal_key,
         name = excluded.name,
         canonical_unit = excluded.canonical_unit,
         numeric_type = excluded.numeric_type,
         decoder_key = excluded.decoder_key,
         decoder_version = excluded.decoder_version,
         precision = excluded.precision,
         default_priority = excluded.default_priority`,
      [
        signal.requestId, signal.requestId, signal.signalType, signal.technicalName,
        signal.unit, signal.numericType, signal.decoderKey, signal.catalogVersion,
        1, 0, signal.precision, signal.priority, now
      ]
    );
  }
}

export async function initializeProductDb(): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (currentState === 'READY' && dbInstance) {
    return dbInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  currentState = 'INITIALIZING';
  initializationPromise = (async () => {
    try {
      // 1. Abrir exactamente autopulse.db
      sqliteDb = await SQLite.openDatabaseAsync('autopulse.db');

      // 2. PRAGMAs mínimos (foreign_keys y WAL se deben fijar por conexión)
      await sqliteDb.execAsync('PRAGMA foreign_keys = ON;');
      await sqliteDb.execAsync('PRAGMA journal_mode = WAL;');
      await sqliteDb.execAsync('PRAGMA busy_timeout = 5000;');

      const fkCheck = await sqliteDb.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;');
      if (fkCheck?.foreign_keys !== 1) {
        throw new Error('Failed to enable foreign keys enforcement on product database.');
      }

      dbInstance = drizzle(sqliteDb, { schema });

      // 3. Inspeccionar identidad antes de migrar (si la tabla existe)
      let isBrandNew = false;
      try {
        const result = await sqliteDb.getFirstAsync<{ database_kind: string }>('SELECT database_kind FROM database_identity LIMIT 1');
        if (result) {
          if (result.database_kind === 'BENCHMARK') {
            throw new Error('UNKNOWN_DATABASE_IDENTITY: Cannot open a BENCHMARK database in Product Lifecycle.');
          }
        }
      } catch (e: any) {
        if (e.message.includes('no such table')) {
          // Base de datos nueva o sin tabla de identidad
          // Revisamos si tiene otras tablas
          const tables = await sqliteDb.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
          if (tables.length > 0) {
            throw new Error('UNKNOWN_DATABASE_IDENTITY: Database is not empty but lacks database_identity table.');
          }
          isBrandNew = true;
        } else {
          throw e;
        }
      }

      // 4. Aplicar migraciones
      await migrate(dbInstance, migrations);
      await seedCoreObdDefinitions(sqliteDb);

      // 5. Confirmar o insertar database_identity = PRODUCT
      let identity = await sqliteDb.getFirstAsync<{ database_kind: string }>('SELECT database_kind FROM database_identity LIMIT 1');

      if (!identity) {
        // La tabla existe pero está vacía (recién migrada o falló en un intento anterior)
        await sqliteDb.runAsync(
          'INSERT INTO database_identity (database_kind, schema_generation, installation_id, created_at) VALUES (?, ?, ?, ?)',
          ['PRODUCT', '1', 'PENDING', Date.now()]
        );
        identity = await sqliteDb.getFirstAsync<{ database_kind: string }>('SELECT database_kind FROM database_identity LIMIT 1');
      }

      if (!identity || identity.database_kind !== 'PRODUCT') {
        throw new Error('UNKNOWN_DATABASE_IDENTITY: Migration failed to set database_identity to PRODUCT.');
      }

      const localContext = await bootstrapProductDb(dbInstance);

      // A new JS process cannot own a previous process's active controller.
      // Reconcile any durable session left in a non-terminal state before the
      // database becomes READY, so History/Summary never expose phantom ACTIVE
      // sessions after a process kill or crash.
      const recoveredOrphans = await new LiveSessionRepository(dbInstance)
        .recoverOrphanedSessions(localContext.defaultWorkspaceId);
      if (recoveredOrphans > 0) {
        console.warn(`[ProductLifecycle] Recovered ${recoveredOrphans} orphaned Live session(s) as INTERRUPTED.`);
      }

      currentState = 'READY';
      return dbInstance;
    } catch (e) {
      currentState = 'FAILED';
      if (sqliteDb) {
        await sqliteDb.closeAsync();
        sqliteDb = null;
      }
      dbInstance = null;
      throw e;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

export async function closeProductDb(): Promise<void> {
  if (!sqliteDb || currentState === 'CLOSED' || currentState === 'UNINITIALIZED') {
    return;
  }

  currentState = 'CLOSING';
  await sqliteDb.closeAsync();
  sqliteDb = null;
  dbInstance = null;
  currentState = 'CLOSED';
}

export function getProductDbState(): LifecycleState {
  return currentState;
}
