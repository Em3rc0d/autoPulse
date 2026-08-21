import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
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
 * Append-only observations from real adapter probes.
 * Compatibility profiles are reusable definitions; these snapshots are the
 * evidence of what one concrete adapter instance actually did at one time.
 */
export const obdAdapterCapabilitySnapshots = sqliteTable('obd_adapter_capability_snapshots', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  adapterInstanceId: text('adapter_instance_id').notNull().references(() => obdAdapterInstances.id, { onDelete: 'restrict' }),
  observedAt: integer('observed_at').notNull(),
  transportType: text('transport_type').notNull(),
  profileMatch: text('profile_match').notNull(),
  matchedProfileId: text('matched_profile_id'),
  compatibilityGrade: text('compatibility_grade').notNull(),
  compatibilityReasonsJson: text('compatibility_reasons_json').notNull(),
  writeCharacteristic: text('write_characteristic'),
  receiveCharacteristic: text('receive_characteristic'),
  writeMode: text('write_mode'),
  receiveMode: text('receive_mode'),
  commandUsed: text('command_used'),
  sanitizedResponse: text('sanitized_response'),
  latencyMs: integer('latency_ms'),
  echoDetected: integer('echo_detected').notNull(),
  promptDetected: integer('prompt_detected').notNull(),
  timedOut: integer('timed_out').notNull(),
  disconnectObserved: integer('disconnect_observed').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  workspaceAdapterObservedIdx: index('idx_adapter_capability_snapshots_workspace_adapter_observed')
    .on(table.workspaceId, table.adapterInstanceId, table.observedAt),
  adapterObservedIdx: index('idx_adapter_capability_snapshots_adapter_observed')
    .on(table.adapterInstanceId, table.observedAt)
}));
