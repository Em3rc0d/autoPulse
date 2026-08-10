import { useState, useEffect } from 'react';
import { useProductDb } from './useProductDb';
import { LiveSessionRepository } from '../database/product/repositories/live-session.repository';

interface UseSessionsOptions {
  workspaceId: string | undefined;
  vehicleId?: string;
}

export function useSessions({ workspaceId, vehicleId }: UseSessionsOptions) {
  const db = useProductDb();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !workspaceId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const repo = new LiveSessionRepository(db);
        const results = vehicleId
          ? await repo.getSessionsForVehicle(workspaceId, vehicleId)
          : await repo.getSessionsForWorkspace(workspaceId);

        if (mounted && results) {
          setSessions(results);
        }
      } catch (err) {
        console.error('[useSessions] Failed to load sessions:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSessions();

    return () => { mounted = false; };
  }, [db, workspaceId, vehicleId]);

  return { sessions, loading };
}

export function useLatestSession({ workspaceId, vehicleId }: { workspaceId: string | undefined, vehicleId: string }) {
  const db = useProductDb();
  const [latestSession, setLatestSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !workspaceId || !vehicleId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const fetchLatest = async () => {
      try {
        setLoading(true);
        const repo = new LiveSessionRepository(db);
        const result = await repo.getLatestSessionForVehicle(workspaceId, vehicleId);

        if (mounted && result) {
          setLatestSession(result);
        }
      } catch (err) {
        console.error('[useLatestSession] Failed to load latest session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLatest();

    return () => { mounted = false; };
  }, [db, workspaceId, vehicleId]);

  return { latestSession, loading };
}
