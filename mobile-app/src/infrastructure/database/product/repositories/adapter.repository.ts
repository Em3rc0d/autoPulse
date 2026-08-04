import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import { eq, and } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { ProductIdGenerator } from '../uuidv7';

export class AdapterRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async createAdapter(workspaceId: string, profile: { alias: string, macAddress: string, platformDeviceId: string, trustState: string }) {
    const id = ProductIdGenerator.generate();
    const now = Date.now();
    const [adapter] = await this.db.insert(schema.obdAdapterInstances).values({
      id,
      workspaceId,
      alias: profile.alias,
      macAddress: profile.macAddress,
      platformDeviceId: profile.platformDeviceId,
      trustState: profile.trustState,
      firstSeen: now,
      lastSeen: now,
      connectionCount: 1,
      createdAt: now,
      updatedAt: now
    } as any).returning();
    return adapter;
  }

  async getAdapter(workspaceId: string, adapterId: string) {
    return this.db.query.obdAdapterInstances.findFirst({
      where: and(
        eq(schema.obdAdapterInstances.id, adapterId),
        eq(schema.obdAdapterInstances.workspaceId, workspaceId)
      )
    });
  }

  async updateAdapter(workspaceId: string, adapterId: string, data: Partial<{ alias: string, platformDeviceId: string, lastSeen: number, trustState: string }>) {
    return this.db.update(schema.obdAdapterInstances)
      .set({ ...data, updatedAt: Date.now() } as any)
      .where(and(
        eq(schema.obdAdapterInstances.id, adapterId),
        eq(schema.obdAdapterInstances.workspaceId, workspaceId)
      ))
      .returning();
  }

  async updateLastSeen(workspaceId: string, adapterId: string) {
    return this.db.update(schema.obdAdapterInstances)
      .set({
        lastSeen: Date.now(),
        updatedAt: Date.now()
      } as any)
      .where(and(
        eq(schema.obdAdapterInstances.id, adapterId),
        eq(schema.obdAdapterInstances.workspaceId, workspaceId)
      ))
      .returning();
  }
  async upsertAdapter(workspaceId: string, profile: { alias: string, platformDeviceId: string, trustState: string, advertisedName?: string }) {
    const existing = await this.db.query.obdAdapterInstances.findFirst({
      where: and(
        eq(schema.obdAdapterInstances.platformDeviceId, profile.platformDeviceId),
        eq(schema.obdAdapterInstances.workspaceId, workspaceId)
      )
    });

    const now = Date.now();
    if (existing) {
      const [updated] = await this.db.update(schema.obdAdapterInstances)
        .set({
          alias: profile.alias,
          advertisedName: profile.advertisedName,
          lastSeen: now,
          updatedAt: now
        } as any)
        .where(eq(schema.obdAdapterInstances.id, existing.id))
        .returning();
      return updated;
    } else {
      const id = ProductIdGenerator.generate();
      const [created] = await this.db.insert(schema.obdAdapterInstances).values({
        id,
        workspaceId,
        alias: profile.alias,
        platformDeviceId: profile.platformDeviceId,
        advertisedName: profile.advertisedName,
        trustState: profile.trustState,
        firstSeen: now,
        lastSeen: now,
        createdAt: now,
        updatedAt: now
      } as any).returning();
      return created;
    }
  }
}
