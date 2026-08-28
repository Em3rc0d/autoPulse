import { check, foreignKey, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { vehicles, workspaces } from './core';
import { liveSessions } from './live';

/** Immutable, evidence-derived Check Lite V1 report for one durable Live session. */
export const vehicleCheckReports = sqliteTable('vehicle_check_reports', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  vehicleId: text('vehicle_id').notNull(),
  sessionId: text('session_id').notNull().references(() => liveSessions.id, { onDelete: 'cascade' }),
  schemaVersion: text('schema_version').notNull(),
  state: text('state').notNull().default('FINAL'),
  snapshotJson: text('snapshot_json').notNull(),
  canonicalJson: text('canonical_json').notNull(),
  sha256: text('sha256').notNull(),
  generatedAt: integer('generated_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  tenantUniqueIdx: unique('uq_vehicle_check_reports_tenant').on(table.workspaceId, table.id),
  sessionUniqueIdx: unique('uq_vehicle_check_reports_session').on(table.sessionId),
  vehicleGeneratedIdx: index('idx_vehicle_check_reports_vehicle_generated').on(table.vehicleId, table.generatedAt),
  stateCheck: check('chk_vehicle_check_report_state', sql`state IN ('FINAL')`),
  shaCheck: check('chk_vehicle_check_report_sha256', sql`length(sha256) = 64`),
  fkVehicleTenant: foreignKey({
    columns: [table.workspaceId, table.vehicleId],
    foreignColumns: [vehicles.workspaceId, vehicles.id],
    name: 'fk_vehicle_check_reports_vehicle_tenant',
  }).onDelete('restrict'),
}));
