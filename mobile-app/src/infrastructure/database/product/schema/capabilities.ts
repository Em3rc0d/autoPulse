import { sqliteTable, text, integer, index, unique, foreignKey } from 'drizzle-orm/sqlite-core';
import { workspaces, vehicles } from './core';
import { obdAdapterInstances } from './adapters';
import { obdParameterDefinitions } from './signals';

export const vehicleCapabilitySnapshots = sqliteTable('vehicle_capability_snapshots', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  vehicleId: text('vehicle_id').notNull(),
  adapterInstanceId: text('adapter_instance_id').notNull(),
  compatibilityProfileVersion: text('compatibility_profile_version').notNull(),
  discoveredAt: integer('discovered_at').notNull(),
  protocolCode: text('protocol_code').notNull(),
  decoderCatalogVersion: text('decoder_catalog_version').notNull(),
  discoveryStatus: text('discovery_status').notNull(),
  rawDiscoveryHash: text('raw_discovery_hash').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  workspaceIdx: index('idx_capability_snapshots_workspace').on(table.workspaceId, table.vehicleId, table.discoveredAt),
  tenantUnique: unique('uq_capability_snapshots_tenant').on(table.workspaceId, table.id),
  // Composite FKs to enforce workspace boundaries
  fkVehicleTenant: foreignKey({
    columns: [table.workspaceId, table.vehicleId],
    foreignColumns: [vehicles.workspaceId, vehicles.id],
    name: 'fk_snapshot_vehicle_tenant'
  }).onDelete('restrict'),
  fkAdapterTenant: foreignKey({
    columns: [table.workspaceId, table.adapterInstanceId],
    foreignColumns: [obdAdapterInstances.workspaceId, obdAdapterInstances.id],
    name: 'fk_snapshot_adapter_tenant'
  }).onDelete('restrict')
}));

export const vehicleCapabilityEcus = sqliteTable('vehicle_capability_ecus', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull().references(() => vehicleCapabilitySnapshots.id, { onDelete: 'cascade' }),
  ecuAddress: integer('ecu_address').notNull(),
  ecuRole: text('ecu_role'),
  firstResponseTimestamp: integer('first_response_timestamp').notNull()
});

export const vehicleCapabilityParameters = sqliteTable('vehicle_capability_parameters', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull().references(() => vehicleCapabilitySnapshots.id, { onDelete: 'cascade' }),
  ecuAddress: integer('ecu_address').notNull(),
  parameterDefinitionId: text('parameter_definition_id').notNull().references(() => obdParameterDefinitions.id, { onDelete: 'restrict' }),
  supportState: text('support_state').notNull(),
  discoveryOutcome: text('discovery_outcome').notNull(),
  errorCode: text('error_code'),
  discoveredAt: integer('discovered_at').notNull()
}, (table) => ({
  snapshotEcuParamIdx: unique('uq_capability_params').on(table.snapshotId, table.ecuAddress, table.parameterDefinitionId)
}));
