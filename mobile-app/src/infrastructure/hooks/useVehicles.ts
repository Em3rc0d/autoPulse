import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useProductDb } from './useProductDb';
import { useLocalContext } from './useLocalContext';
import { VehicleRepository } from '../database/product/repositories/vehicle.repository';

export function useVehicles() {
  const db = useProductDb();
  const { context, loading: contextLoading } = useLocalContext();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicles = useCallback(async () => {
    if (!db || !context) return;
    try {
      setLoading(true);
      const repo = new VehicleRepository(db);
      const data = await repo.listVehicles(context.defaultWorkspaceId);
      setVehicles(data);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [db, context]);

  useFocusEffect(
    useCallback(() => {
      if (!contextLoading && db && context) {
        fetchVehicles();
      }
    }, [contextLoading, db, context, fetchVehicles])
  );

  return { vehicles, loading, error, refresh: fetchVehicles };
}
