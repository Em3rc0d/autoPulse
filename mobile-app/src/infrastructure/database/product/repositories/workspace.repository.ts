import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import { eq, and } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';

export class WorkspaceRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async getLocalWorkspace(workspaceId: string) {
    return this.db.query.workspaces.findFirst({
      where: eq(schema.workspaces.id, workspaceId)
    });
  }

  async updateName(workspaceId: string, name: string) {
    return this.db.update(schema.workspaces)
      .set({ name, updatedAt: Date.now() })
      .where(eq(schema.workspaces.id, workspaceId))
      .returning();
  }
}
