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
    // Read all rows to provide evidence
    const allRows = await expoDb.getAllAsync<{ id: number; boot_version: string; created_at: number; notes: string | null }>('SELECT * FROM technical_health_checks');
    let verificationEvidence = {
      rowCount: allRows.length,
      rows: allRows
    };

    if (allRows.length > 0) {
      isReadable = true;
      isWritable = true;
      
      // Si la fila del Build A no tiene notes (es null), la actualizamos para probar escritura en Build B
      const firstRow = allRows[0];
      if (firstRow.notes === null) {
        await expoDb.runAsync('UPDATE technical_health_checks SET notes = ? WHERE id = ?', ['Updated in Build B (0002)', firstRow.id]);
        
        // Refresh evidence
        const updatedRows = await expoDb.getAllAsync<{ id: number; boot_version: string; created_at: number; notes: string | null }>('SELECT * FROM technical_health_checks');
        verificationEvidence = {
          rowCount: updatedRows.length,
          rows: updatedRows
        };
      }
    } else {
      const result = await expoDb.runAsync('INSERT INTO technical_health_checks (boot_version, created_at, notes) VALUES (?, ?, ?)', ['v2', Date.now(), 'Build B Migration 0002 Check']);
      if (result.changes > 0) {
        isWritable = true;
      }
      const newRows = await expoDb.getAllAsync<{ id: number; boot_version: string; created_at: number; notes: string | null }>('SELECT * FROM technical_health_checks');
      if (newRows.length > 0) {
        isReadable = true;
      }
      verificationEvidence = {
        rowCount: newRows.length,
        rows: newRows
      };
    }
    
    state = 'HEALTHY';

    return {
      state,
      databaseName: DATABASE_NAME,
      expectedVersion: '0002',
      isReadable,
      isWritable,
      isSafeToContinueLegacy: true,
      durationMs: Date.now() - startTime,
      verificationEvidence
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
      expectedVersion: '0002',
      isReadable: false,
      isWritable: false,
      isSafeToContinueLegacy: true,
      errorCode: errorMsg,
      durationMs: Date.now() - startTime
    };
  }
}
