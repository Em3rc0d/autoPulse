import { sqliteTable, text, integer, unique, index, foreignKey } from 'drizzle-orm/sqlite-core';
import { workspaces } from './core';

export const obdAdapterModels = sqliteTable('obd_adapter_models', {
  id: text('id').primaryKey(),
  manufacturer: text('manufacturer'),
  modelName: text('model_name').notNull(),
  transportFamily: text('transport_family').notNull(),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at')
});

export const obdAdapterCompatibilityProfiles = sqliteTable('obd_adapter_compatibility_profiles', {
  id: text('id').primaryKey(),
  adapterModelId: text('adapter_model_id').notNull().references(() => obdAdapterModels.id, { onDelete: 'restrict' }),
  profileVersion: text('profile_version').notNull(),
  compatibilityStatus: text('compatibility_status').notNull(),
  transportType: text('transport_type').notNull(),
  serviceFingerprint: text('service_fingerprint'),
  writeCharacteristic: text('write_characteristic'),
  notifyCharacteristic: text('notify_characteristic'),
  writeMode: text('write_mode'),
  framingProfile: text('framing_profile'),
  initializationProfile: text('initialization_profile'),
  firmwareConstraints: text('firmware_constraints'),
  profileHash: text('profile_hash').notNull(),
  createdAt: integer('created_at').notNull()
});

export const obdAdapterInstances = sqliteTable('obd_adapter_instances', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  adapterModelId: text('adapter_model_id').references(() => obdAdapterModels.id, { onDelete: 'restrict' }),
  alias: text('alias'),
  platformDeviceId: text('platform_device_id').notNull(),
  advertisedName: text('advertised_name'),
  lastServiceFingerprint: text('last_service_fingerprint'),
  firstSeen: integer('first_seen').notNull(),
  lastSeen: integer('last_seen').notNull(),
  lastSuccessfulConnection: integer('last_successful_connection'),
  reportedFirmware: text('reported_firmware'),
  trustState: text('trust_state').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  archivedAt: integer('archived_at'),
  lastTransportType: text('last_transport_type'),
  lastCompatibilityProfileId: text('last_compatibility_profile_id').references(() => obdAdapterCompatibilityProfiles.id, { onDelete: 'restrict' })
}, (table) => ({
  workspacePlatformIdx: unique('uq_adapter_instances_platform').on(table.workspaceId, table.platformDeviceId),
  workspaceLastSeenIdx: index('idx_adapter_instances_last_seen').on(table.workspaceId, table.lastSeen),
  tenantUnique: unique('uq_adapter_instances_tenant').on(table.workspaceId, table.id)
}));

/**
 * Append-only evidence captured by Adapter Discovery.
 * A snapshot explains why an adapter received a compatibility grade at a point in time.
 * It must never contain or imply vehicle PID support.
 */
export const adapterCapabilitySnapshots = sqliteTable('adapter_capability_snapshots', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  adapterInstanceId: text('adapter_instance_id').notNull(),
  schemaVersion: text('schema_version').notNull(),
  transport: text('transport').notNull(),
  deviceName: text('device_name'),
  rssi: integer('rssi'),
  profileMatch: text('profile_match').notNull(),
  compatibilityGrade: text('compatibility_grade').notNull(),
  writeCharacteristicUuid: text('write_characteristic_uuid'),
  receiveCharacteristicUuid: text('receive_characteristic_uuid'),
  testedCombinationCount: integer('tested_combination_count').notNull(),
  commandUsed: text('command_used'),
  sanitizedResponse: text('sanitized_response'),
  bytesWritten: integer('bytes_written'),
  latencyMs: integer('latency_ms'),
  echoObserved: integer('echo_observed', { mode: 'boolean' }),
  promptObserved: integer('prompt_observed', { mode: 'boolean' }),
  probeStage: text('probe_stage').notNull(),
  failureReason: text('failure_reason'),
  connectionRetained: integer('connection_retained', { mode: 'boolean' }).notNull(),
  assessedAt: integer('assessed_at').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  workspaceAdapterAssessedIdx: index('idx_adapter_capability_snapshots_workspace_adapter_assessed')
    .on(table.workspaceId, table.adapterInstanceId, table.assessedAt),
  tenantUnique: unique('uq_adapter_capability_snapshots_tenant').on(table.workspaceId, table.id),
  fkAdapterTenant: foreignKey({
    columns: [table.workspaceId, table.adapterInstanceId],
    foreignColumns: [obdAdapterInstances.workspaceId, obdAdapterInstances.id],
    name: 'fk_adapter_capability_snapshot_adapter_tenant'
  }).onDelete('restrict')
}));
