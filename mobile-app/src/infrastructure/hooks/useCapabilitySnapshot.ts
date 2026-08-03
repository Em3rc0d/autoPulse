import { useState, useEffect } from 'react';
import { useProductDb } from './useProductDb';
import { CapabilitySnapshotRepository } from '../database/product/repositories/capability-snapshot.repository';

export function useCapabilitySnapshot(workspaceId: string | undefined, vehicleId: string) {
  const db = useProductDb();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [parameters, setParameters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !workspaceId || !vehicleId) {
      if (!workspaceId) setLoading(false);
      return;
    }

    let mounted = true;
    const fetchSnapshot = async () => {
      try {
        setLoading(true);
        const repo = new CapabilitySnapshotRepository(db);
        const latestSnapshot = await repo.getLatestSnapshot(workspaceId, vehicleId);

        if (mounted && latestSnapshot) {
          setSnapshot(latestSnapshot);
          const params = await repo.getSnapshotWithParameters(latestSnapshot.id);
          setParameters(params);
        }
      } catch (err) {
        console.error('Failed to load capability snapshot:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSnapshot();

    return () => { mounted = false; };
  }, [db, workspaceId, vehicleId]);

  return { snapshot, parameters, loading };
}
