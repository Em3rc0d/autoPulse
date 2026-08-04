import { useState } from 'react';
import { useProductDb } from './useProductDb';
import { useLocalContext } from './useLocalContext';
import { VehicleRepository } from '../database/product/repositories/vehicle.repository';

export function useCreateVehicle() {
  const db = useProductDb();
  const { context } = useLocalContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createVehicle = async (data: { alias: string; vin?: string; make?: string; model?: string; year?: number }) => {
    if (!db || !context) throw new Error('Database or context not ready');
    setLoading(true);
    setError(null);
    try {
      const repo = new VehicleRepository(db);
      const vehicle = await repo.createVehicle(context.defaultWorkspaceId, {
        alias: data.alias,
        vin: data.vin,
        make: data.make,
        model: data.model,
        year: data.year,
      });
      return vehicle.id;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createVehicle, loading, error };
}
