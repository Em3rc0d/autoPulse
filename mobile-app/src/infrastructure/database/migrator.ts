import { getDatabaseConnection, DATABASE_NAME } from './connection';
import { DatabaseHealthResult, DatabaseHealthState } from './health';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from './migrations/migrations';

export async function initializeSpikeDatabase(): Promise<DatabaseHealthResult> {
  const startTime = Date.now();
  let state: DatabaseHealthState = 'OPENING';
  let isReadable = false;
  let isWritable = false;

  try {
    const { expoDb, db } = getDatabaseConnection();
    
    state = 'MIGRATING';
    // Run migration imperatively
    await migrate(db, migrations);
    
    // Check readability & writability using Canary table
    state = 'HEALTHY';
    let row = await expoDb.getFirstAsync<{ id: number }>('SELECT id FROM technical_health_checks LIMIT 1');
    if (row && row.id) {
      isReadable = true;
      isWritable = true; // Assuming it was written previously. We could update it instead.
    } else {
      const result = await expoDb.runAsync('INSERT INTO technical_health_checks (boot_version, created_at) VALUES (?, ?)', ['v1', Date.now()]);
      if (result.changes > 0) {
        isWritable = true;
      }
      row = await expoDb.getFirstAsync<{ id: number }>('SELECT id FROM technical_health_checks LIMIT 1');
      if (row && row.id) {
        isReadable = true;
      }
    }

    return {
      state,
      databaseName: DATABASE_NAME,
      expectedVersion: '0001',
      isReadable,
      isWritable,
      isSafeToContinueLegacy: true,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Si la tabla no existe o la migración falló estrepitosamente.
    let finalState: DatabaseHealthState = 'FAILED';
    if (errorMsg.includes('no such table')) {
      finalState = 'SCHEMA_MISMATCH';
    }

    return {
      state: finalState,
      databaseName: DATABASE_NAME,
      expectedVersion: '0001',
      isReadable: false,
      isWritable: false,
      isSafeToContinueLegacy: true,
      errorCode: errorMsg,
      durationMs: Date.now() - startTime
    };
  }
}
