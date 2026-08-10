import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import * as Crypto from 'expo-crypto';
import { ProductIdGenerator } from './uuidv7';
import { sql } from 'drizzle-orm';

function isInstallationIdPlaceholder(id: string | null | undefined): boolean {
  return id == null || id.trim() === '' || id === 'PENDING';
}

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

      // Sync installationId to databaseIdentity
      await tx.update(schema.databaseIdentity)
        .set({ installationId })
        .where(sql`database_kind = 'PRODUCT'`);

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

      // Ensure Virtual Adapter Infrastructure
      await tx.insert(schema.obdAdapterModels).values({
        id: 'model-virtual',
        manufacturer: 'AutoPulse',
        modelName: 'Virtual Adapter',
        transportFamily: 'VIRTUAL',
        createdAt: now
      } as any).onConflictDoNothing();

      await tx.insert(schema.obdAdapterInstances).values({
        id: 'virtual-adapter',
        workspaceId,
        adapterModelId: 'model-virtual',
        alias: 'Virtual Device',
        platformDeviceId: 'virtual:device',
        firstSeen: now,
        lastSeen: now,
        trustState: 'TRUSTED',
        createdAt: now,
        updatedAt: now
      } as any).onConflictDoNothing();

      return newContext;
    }

    // 5. If it exists, validate the references
    const context = contexts[0];
    const identityId = identityResult[0].installationId;
    const contextId = context.installationId;

    let finalInstallationId = contextId;

    const isIdentityPlaceholder = isInstallationIdPlaceholder(identityId);
    const isContextPlaceholder = isInstallationIdPlaceholder(contextId);

    if (isIdentityPlaceholder && isContextPlaceholder) {
      const newId = ProductIdGenerator.generate();
      await tx.update(schema.databaseIdentity)
        .set({ installationId: newId })
        .where(sql`database_kind = 'PRODUCT'`);
      await tx.update(schema.localAppContext)
        .set({ installationId: newId })
        .where(sql`singleton_key = 1`);
      finalInstallationId = newId;
    } else if (isIdentityPlaceholder && !isContextPlaceholder) {
      // Sync context -> DB
      await tx.update(schema.databaseIdentity)
        .set({ installationId: contextId })
        .where(sql`database_kind = 'PRODUCT'`);
      finalInstallationId = contextId;
    } else if (!isIdentityPlaceholder && isContextPlaceholder) {
      // Sync DB -> context
      await tx.update(schema.localAppContext)
        .set({ installationId: identityId })
        .where(sql`singleton_key = 1`);
      finalInstallationId = identityId;
    } else if (identityId !== contextId) {
      throw new Error('LOCAL_CONTEXT_CORRUPT: Mismatching real installation IDs between database identity and local app context.');
    }

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

    const now = Date.now();
    // Ensure Virtual Adapter Infrastructure
    await tx.insert(schema.obdAdapterModels).values({
      id: 'model-virtual',
      manufacturer: 'AutoPulse',
      modelName: 'Virtual Adapter',
      transportFamily: 'VIRTUAL',
      createdAt: now
    } as any).onConflictDoNothing();

    await tx.insert(schema.obdAdapterInstances).values({
      id: 'virtual-adapter',
      workspaceId: context.defaultWorkspaceId,
      adapterModelId: 'model-virtual',
      alias: 'Virtual Device',
      platformDeviceId: 'virtual:device',
      firstSeen: now,
      lastSeen: now,
      trustState: 'TRUSTED',
      createdAt: now,
      updatedAt: now
    } as any).onConflictDoNothing();

    return { ...context, installationId: finalInstallationId };
  });
}
