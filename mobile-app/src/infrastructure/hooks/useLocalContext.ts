import { useState, useEffect } from 'react';
import { useProductDb } from './useProductDb';
import { LiveSessionRepository } from '../database/product/repositories/live-session.repository';

export function useLocalContext() {
  const db = useProductDb();
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;

    let mounted = true;
    const fetchContext = async () => {
      try {
        const result = await db.query.localAppContext.findFirst();
        if (mounted && result) {
          setContext(result);
        }
      } catch (err) {
        console.error('Failed to load local context:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchContext();
    return () => { mounted = false; };
  }, [db]);

  return { context, loading };
}
