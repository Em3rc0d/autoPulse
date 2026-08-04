import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import * as Crypto from 'expo-crypto';
import { ProductIdGenerator } from './uuidv7';
import { sql } from 'drizzle-orm';

export async function bootstrapProductDb(db: ExpoSQLiteDatabase<typeof schema>) {
  // Use a transaction since we are creating multiple roots.
  return await db.transaction(async (tx) => {
    // 1. Check database identity explicitly inside the transaction to avoid race conditions.
    const identityResult = await tx.select().from(schema.databaseIdentity).limit(1);
    if (identityResult.length === 0 || identityResult[0].databaseKind !== 'PRODUCT') {
      throw new Error('LOCAL_CONTEXT_CORRUPT: Cannot bootstrap a non-product database.');
    }

    // 2. Count rows of local_app_context
    const contexts = await tx.select().from(schema.localAppContext);

    // 3. Reject more than one row
    if (contexts.length > 1) {
      throw new Error('LOCAL_CONTEXT_CORRUPT: Multiple app contexts found. The database is in an inconsistent state.');
    }

    // 4. If no rows exist, create the initial data
    if (contexts.length === 0) {
      const installationId = ProductIdGenerator.generate();
      const workspaceId = ProductIdGenerator.generate();
      const operatorId = ProductIdGenerator.generate();
      const now = Date.now();

      await tx.insert(schema.workspaces).values({
        id: workspaceId,
        name: 'My Garage',
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(schema.operators).values({
        id: operatorId,
        workspaceId,
        name: 'Owner',
        createdAt: now,
        updatedAt: now,
      });

      const [newContext] = await tx.insert(schema.localAppContext).values({
        singletonKey: 1,
        installationId,
        defaultWorkspaceId: workspaceId,
        defaultOperatorId: operatorId,
        createdAt: now,
        updatedAt: now,
      } as any).returning();

      return newContext;
    }

    // 5. If it exists, validate the references
    const context = contexts[0];

    const workspace = await tx.query.workspaces.findFirst({
      where: (ws, { eq }) => eq(ws.id, context.defaultWorkspaceId)
    });

    const operator = await tx.query.operators.findFirst({
      where: (op, { eq, and }) => and(
        eq(op.id, context.defaultOperatorId),
        eq(op.workspaceId, context.defaultWorkspaceId) // Check tenant boundary
      )
    });

    if (!workspace || !operator) {
      throw new Error('LOCAL_CONTEXT_CORRUPT: The default workspace or operator is missing or violates tenant boundaries.');
    }

    return context;
  });
}
