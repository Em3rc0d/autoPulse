import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useProductDb } from './useProductDb';
import { useLocalContext } from './useLocalContext';
import { VehicleRepository } from '../database/product/repositories/vehicle.repository';

export function useVehicle(vehicleId: string) {
  const db = useProductDb();
  const { context, loading: contextLoading } = useLocalContext();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicle = useCallback(async () => {
    if (!db || !context || !vehicleId) return;
    try {
      setLoading(true);
      const repo = new VehicleRepository(db);
      const data = await repo.getVehicle(context.defaultWorkspaceId, vehicleId);
      setVehicle(data);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [db, context, vehicleId]);

  useFocusEffect(
    useCallback(() => {
      if (!contextLoading && db && context && vehicleId) {
        fetchVehicle();
      }
    }, [contextLoading, db, context, vehicleId, fetchVehicle])
  );

  return { vehicle, loading, error, refresh: fetchVehicle };
}
