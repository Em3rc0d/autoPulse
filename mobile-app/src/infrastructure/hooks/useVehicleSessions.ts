import { useState, useEffect } from 'react';
import { useProductDb } from './useProductDb';
import { LiveSessionRepository } from '../database/product/repositories/live-session.repository';

export function useVehicleSessions(workspaceId: string | undefined, vehicleId: string) {
  const db = useProductDb();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !workspaceId || !vehicleId) {
      if (!workspaceId) setLoading(false);
      return;
    }

    let mounted = true;
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const repo = new LiveSessionRepository(db);
        const results = await repo.getSessionsForVehicle(workspaceId, vehicleId);

        if (mounted && results) {
          setSessions(results);
        }
      } catch (err) {
        console.error('Failed to load vehicle sessions:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSessions();

    return () => { mounted = false; };
  }, [db, workspaceId, vehicleId]);

  return { sessions, loading };
}
