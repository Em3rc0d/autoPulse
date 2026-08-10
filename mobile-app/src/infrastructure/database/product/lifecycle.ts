import * as SQLite from 'expo-sqlite';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';
import migrations from './migrations/migrations';
import { bootstrapProductDb } from './bootstrap';

export type LifecycleState = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'FAILED' | 'CLOSING' | 'CLOSED';

let currentState: LifecycleState = 'UNINITIALIZED';
let initializationPromise: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;
let dbInstance: ExpoSQLiteDatabase<typeof schema> | null = null;
let sqliteDb: SQLite.SQLiteDatabase | null = null;

async function seedCoreObdDefinitions(database: SQLite.SQLiteDatabase) {
  const now = Date.now();
  const parameters = [
    ['0100', 'MODE_01', 1, 0x00, 'Supported PIDs 01-20'],
    ['0120', 'MODE_01', 1, 0x20, 'Supported PIDs 21-40'],
    ['0140', 'MODE_01', 1, 0x40, 'Supported PIDs 41-60'],
    ['0160', 'MODE_01', 1, 0x60, 'Supported PIDs 61-80'],
    ['0180', 'MODE_01', 1, 0x80, 'Supported PIDs 81-A0'],
    ['010C', 'MODE_01', 1, 0x0c, 'Engine RPM'],
    ['010D', 'MODE_01', 1, 0x0d, 'Vehicle speed'],
    ['0105', 'MODE_01', 1, 0x05, 'Engine coolant temperature'],
    ['0142', 'MODE_01', 1, 0x42, 'Control module voltage'],
    ['ATRV', 'ELM_AT', 0, 0, 'Adapter Voltage'],
    ['0104', 'MODE_01', 1, 0x04, 'Calculated engine load'],
    ['010B', 'MODE_01', 1, 0x0b, 'Intake manifold absolute pressure'],
    ['010E', 'MODE_01', 1, 0x0e, 'Timing advance'],
    ['010F', 'MODE_01', 1, 0x0f, 'Intake air temperature'],
    ['0110', 'MODE_01', 1, 0x10, 'MAF air flow rate'],
    ['0111', 'MODE_01', 1, 0x11, 'Throttle position'],
    ['012F', 'MODE_01', 1, 0x2f, 'Fuel Level Input'],
    ['015C', 'MODE_01', 1, 0x5c, 'Engine oil temperature']
  ] as const;

  for (const [id, namespace, service, pid, technicalName] of parameters) {
    await database.runAsync(
      'INSERT OR IGNORE INTO obd_parameter_definitions (id, namespace, service, parameter_identifier, technical_name, request_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, namespace, service, pid, technicalName, '1.0', now]
    );
  }

  const signals = [
    ['010C', '010C', 'ENGINE_RPM', 'Engine RPM', 'RPM', 'float', 'MODE01_010C', '1.0', 1, 0, 0, 'HIGH'],
    ['010D', '010D', 'VEHICLE_SPEED', 'Vehicle speed', 'km/h', 'integer', 'MODE01_010D', '1.0', 1, 0, 0, 'HIGH'],
    ['0105', '0105', 'ENGINE_COOLANT', 'Engine coolant temperature', '°C', 'float', 'MODE01_0105', '1.0', 1, 0, 1, 'MEDIUM'],
    ['0142', '0142', 'CONTROL_MODULE_VOLTAGE', 'Control module voltage', 'V', 'float', 'MODE01_0142', '1.0', 1, 0, 2, 'LOW'],
    ['ATRV', 'ATRV', 'ADAPTER_VOLTAGE', 'Adapter voltage', 'V', 'float', 'AT_ATRV', '1.0', 1, 0, 1, 'LOW'],
    ['0104', '0104', 'ENGINE_LOAD', 'Calculated engine load', '%', 'float', 'MODE01_0104', '1.0', 1, 0, 1, 'MEDIUM'],
    ['010B', '010B', 'MAP', 'Intake manifold absolute pressure', 'kPa', 'integer', 'MODE01_010B', '1.0', 1, 0, 0, 'MEDIUM'],
    ['010E', '010E', 'TIMING_ADVANCE', 'Timing advance', 'deg', 'float', 'MODE01_010E', '1.0', 1, 0, 1, 'LOW'],
    ['010F', '010F', 'INTAKE_TEMP', 'Intake air temperature', '°C', 'float', 'MODE01_010F', '1.0', 1, 0, 1, 'LOW'],
    ['0110', '0110', 'MAF', 'MAF air flow rate', 'g/s', 'float', 'MODE01_0110', '1.0', 1, 0, 2, 'MEDIUM'],
    ['0111', '0111', 'THROTTLE_POSITION', 'Throttle position', '%', 'float', 'MODE01_0111', '1.0', 1, 0, 1, 'MEDIUM'],
    ['012F', '012F', 'FUEL_LEVEL', 'Fuel Level Input', '%', 'float', 'MODE01_012F', '1.0', 1, 0, 1, 'LOW'],
    ['015C', '015C', 'ENGINE_OIL_TEMP', 'Engine oil temperature', '°C', 'float', 'MODE01_015C', '1.0', 1, 0, 1, 'LOW']
  ] as const;

  for (const [id, parameterDefinitionId, signalKey, name, unit, numericType, decoderKey, decoderVersion, scale, offset, precision, priority] of signals) {
    await database.runAsync(
      'INSERT OR IGNORE INTO signal_definitions (id, parameter_definition_id, signal_key, name, canonical_unit, numeric_type, decoder_key, decoder_version, scale, offset, precision, default_priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, parameterDefinitionId, signalKey, name, unit, numericType, decoderKey, decoderVersion, scale, offset, precision, priority, now]
    );
  }

  // Pre-seed generic Mode 01 (0x01-0xFF) to satisfy FK constraints for discovered capabilities.
  // We use "Unmapped Mode 01 Parameter" to clarify these are placeholders for ECU-discovered capabilities,
  // not fully interpreted canonical J1979 definitions.
  for (let i = 1; i <= 255; i++) {
    const hex = i.toString(16).padStart(2, '0').toUpperCase();
    await database.runAsync(
      'INSERT OR IGNORE INTO obd_parameter_definitions (id, namespace, service, parameter_identifier, technical_name, request_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [`01${hex}`, 'MODE_01', 1, i, `Unmapped Mode 01 Parameter 0x${hex}`, '1.0', now]
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

      await bootstrapProductDb(dbInstance);

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
