import { useState, useEffect } from 'react';
import { initializeProductDb } from '../database/product/lifecycle';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../database/product/schema';

/**
 * Returns the already-initialized product database instance.
 * Safe to use in any screen since App.tsx guarantees initialization before rendering.
 */
export function useProductDb() {
  const [db, setDb] = useState<ExpoSQLiteDatabase<typeof schema> | null>(null);

  useEffect(() => {
    let mounted = true;
    initializeProductDb().then(instance => {
      if (mounted) setDb(instance);
    }).catch(console.error);

    return () => { mounted = false; };
  }, []);

  return db;
}
