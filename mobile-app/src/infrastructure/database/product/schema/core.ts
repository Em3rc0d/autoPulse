import { sqliteTable, text, integer, unique, index, foreignKey, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const databaseIdentity = sqliteTable('database_identity', {
  databaseKind: text('database_kind').notNull(), // 'PRODUCT' or 'BENCHMARK'
  schemaGeneration: text('schema_generation').notNull(),
  installationId: text('installation_id').notNull(),
  createdAt: integer('created_at').notNull()
});

export const localAppContext = sqliteTable('local_app_context', {
  singletonKey: integer('singleton_key').primaryKey().default(1),
  installationId: text('installation_id').notNull(),
  defaultWorkspaceId: text('default_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  defaultOperatorId: text('default_operator_id').notNull().references(() => operators.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  singletonCheck: check('chk_singleton_key', sql`singleton_key = 1`)
}));

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  workspaceIdIdx: index('idx_operators_workspace').on(table.workspaceId),
  tenantUnique: unique('uq_operators_tenant').on(table.workspaceId, table.id)
}));

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  alias: text('alias').notNull(),
  vin: text('vin'),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  licensePlate: text('license_plate'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  workspaceIdIdx: index('idx_vehicles_workspace').on(table.workspaceId),
  workspaceCreatedAtIdx: index('idx_vehicles_workspace_created').on(table.workspaceId, table.createdAt),
  tenantUnique: unique('uq_vehicles_tenant').on(table.workspaceId, table.id)
}));
