import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

export const DATABASE_NAME = 'autopulse_spike.db';

export function getDatabaseConnection() {
  const expoDb = SQLite.openDatabaseSync(DATABASE_NAME);
  const db = drizzle(expoDb);
  return { expoDb, db };
}
