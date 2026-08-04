import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

export const BENCHMARK_DB_NAME = 'autopulse_benchmark.db';

export const META_DDL = `
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  device_info TEXT,
  android_version TEXT,
  build_type TEXT,
  commit_sha TEXT,
  run_date INTEGER,
  load_profile TEXT,
  configured_duration_ms INTEGER,
  block_duration_ms INTEGER,
  format TEXT,
  codec TEXT,
  sqlite_config TEXT,
  state TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  interruption_reason TEXT,
  final_result TEXT
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  benchmark_run_id TEXT NOT NULL,
  started_at INTEGER
);
`;

export const PAYLOAD_DDL = `
CREATE TABLE IF NOT EXISTS live_telemetry_blocks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  window_end INTEGER NOT NULL,
  sample_count INTEGER NOT NULL,
  signal_count INTEGER NOT NULL,
  payload_format TEXT NOT NULL,
  payload_schema_version TEXT NOT NULL,
  compression_codec TEXT NOT NULL,
  payload_blob TEXT NOT NULL,
  uncompressed_size_bytes INTEGER NOT NULL,
  stored_size_bytes INTEGER NOT NULL,
  content_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_telemetry_block_summaries (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL,
  signal_definition_id TEXT NOT NULL,
  min_val REAL,
  max_val REAL,
  avg_val REAL,
  last_val REAL,
  valid_samples INTEGER NOT NULL,
  degraded_samples INTEGER,
  FOREIGN KEY(block_id) REFERENCES live_telemetry_blocks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_blocks_session_seq ON live_telemetry_blocks(session_id, sequence_number);
`;

export async function openBenchmarkDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(BENCHMARK_DB_NAME);
  // Optional pragmas for B1
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);
  return db;
}

export async function resetBenchmarkDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(BENCHMARK_DB_NAME);
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS live_telemetry_block_summaries;
    DROP TABLE IF EXISTS live_telemetry_blocks;
    DROP TABLE IF EXISTS live_sessions;
    DROP TABLE IF EXISTS benchmark_runs;
    PRAGMA foreign_keys = ON;
  `);
  await db.execAsync(META_DDL);
  return db;
}

export async function initBenchmarkDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await openBenchmarkDb();
  await db.execAsync(META_DDL);
  return db;
}

export async function openPayloadDb(runId: string): Promise<SQLite.SQLiteDatabase> {
  const dbName = `benchmark_payload_${runId}.db`;
  const db = await SQLite.openDatabaseAsync(dbName);
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    PRAGMA journal_mode = WAL;
  `);
  await db.execAsync(PAYLOAD_DDL);
  return db;
}

export async function deletePayloadDb(runId: string): Promise<void> {
  const dbName = `benchmark_payload_${runId}.db`;
  const dbDir = FileSystem.documentDirectory + 'SQLite/';

  await FileSystem.deleteAsync(dbDir + dbName, { idempotent: true });
  await FileSystem.deleteAsync(dbDir + dbName + '-wal', { idempotent: true });
  await FileSystem.deleteAsync(dbDir + dbName + '-shm', { idempotent: true });
}

export interface DbSizeInfo {
  main: number;
  wal: number;
  shm: number;
  total: number;
}

export async function getPayloadDbSize(runId: string): Promise<DbSizeInfo> {
  const dbName = `benchmark_payload_${runId}.db`;
  const dbDir = FileSystem.documentDirectory + 'SQLite/';

  const mainInfo = await FileSystem.getInfoAsync(dbDir + dbName);
  const walInfo = await FileSystem.getInfoAsync(dbDir + dbName + '-wal');
  const shmInfo = await FileSystem.getInfoAsync(dbDir + dbName + '-shm');

  const main = mainInfo.exists ? mainInfo.size : 0;
  const wal = walInfo.exists ? walInfo.size : 0;
  const shm = shmInfo.exists ? shmInfo.size : 0;

  return {
    main,
    wal,
    shm,
    total: main + wal + shm
  };
}
