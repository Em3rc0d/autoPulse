import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../schema';
import { eq, and } from 'drizzle-orm';

export class OperatorRepository {
  constructor(private db: ExpoSQLiteDatabase<typeof schema>) {}

  async getOperator(workspaceId: string, operatorId: string) {
    return this.db.query.operators.findFirst({
      where: and(
        eq(schema.operators.id, operatorId),
        eq(schema.operators.workspaceId, workspaceId)
      )
    });
  }

  async listOperators(workspaceId: string) {
    return this.db.query.operators.findMany({
      where: eq(schema.operators.workspaceId, workspaceId)
    });
  }

  async updateName(workspaceId: string, operatorId: string, name: string) {
    return this.db.update(schema.operators)
      .set({ name, updatedAt: Date.now() })
      .where(and(
        eq(schema.operators.id, operatorId),
        eq(schema.operators.workspaceId, workspaceId)
      ))
      .returning();
  }
}
