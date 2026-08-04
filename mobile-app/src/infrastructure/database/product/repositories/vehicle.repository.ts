import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import { eq, and } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { ProductIdGenerator } from '../uuidv7';

export class VehicleRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async createVehicle(workspaceId: string, profile: { alias: string, vin?: string, make?: string, model?: string, year?: number }) {
    const id = ProductIdGenerator.generate();
    const now = Date.now();
    const [vehicle] = await this.db.insert(schema.vehicles).values({
      id,
      workspaceId,
      alias: profile.alias,
      vin: profile.vin,
      make: profile.make,
      model: profile.model,
      year: profile.year,
      createdAt: now,
      updatedAt: now
    } as any).returning();
    return vehicle;
  }

  async getVehicle(workspaceId: string, vehicleId: string) {
    return this.db.query.vehicles.findFirst({
      where: and(
        eq(schema.vehicles.id, vehicleId),
        eq(schema.vehicles.workspaceId, workspaceId)
      )
    });
  }

  async listVehicles(workspaceId: string) {
    return this.db.query.vehicles.findMany({
      where: eq(schema.vehicles.workspaceId, workspaceId)
    });
  }

  async updateVehicle(workspaceId: string, vehicleId: string, data: Partial<{ vin: string, make: string, model: string, year: number }>) {
    return this.db.update(schema.vehicles)
      .set({ ...data, updatedAt: Date.now() } as any)
      .where(and(
        eq(schema.vehicles.id, vehicleId),
        eq(schema.vehicles.workspaceId, workspaceId)
      ))
      .returning();
  }
}
