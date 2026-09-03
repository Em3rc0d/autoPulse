import { sqliteTable, text, integer, unique, index, foreignKey, check, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces, operators, vehicles } from './core';
import { obdAdapterInstances } from './adapters';
import { vehicleCapabilitySnapshots } from './capabilities';
import { signalDefinitions } from './signals';
import { hermesBlob } from './HermesBlob';

export const liveSessions = sqliteTable('live_sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  vehicleId: text('vehicle_id').notNull(),
  operatorId: text('operator_id').notNull(),
  adapterInstanceId: text('adapter_instance_id').notNull(),
  capabilitySnapshotId: text('capability_snapshot_id'),

  adapterProfileVersion: text('adapter_profile_version'),
  adapterFirmwareVersion: text('adapter_firmware_version'),
  decoderCatalogVersion: text('decoder_catalog_version'),
  format: text('format').notNull(),
  formatVersion: text('format_version').notNull(),
  codec: text('codec').notNull(),

  startedAt: integer('started_at'),
  endedAt: integer('ended_at'),
  status: text('status').notNull(),
  stopReason: text('stop_reason'),
  failureCode: text('failure_code'),
  recoveredAt: integer('recovered_at'),
  completedAt: integer('completed_at'),

  protocolCode: text('protocol_code'),
  transportType: text('transport_type'),
  chunkDurationMs: integer('chunk_duration_ms').notNull(),
  dictionaryVersion: text('dictionary_version').notNull(),

  lastCommittedSequence: integer('last_committed_sequence'),
  totalBlocks: integer('total_blocks').notNull().default(0),
  totalEvents: integer('total_events').notNull().default(0),
  totalReadings: integer('total_readings').notNull().default(0),
  totalTimeouts: integer('total_timeouts').notNull().default(0),
  totalDisconnects: integer('total_disconnects').notNull().default(0),

  createdAt: integer('created_at').notNull()
}, (table) => ({
  workspaceStartedIdx: index('idx_live_sessions_workspace_started').on(table.workspaceId, table.startedAt),
  vehicleStartedIdx: index('idx_live_sessions_vehicle_started').on(table.vehicleId, table.startedAt),
  workspaceStatusIdx: index('idx_live_sessions_workspace_status').on(table.workspaceId, table.status),
  tenantUniqueIdx: unique('uq_live_sessions_tenant').on(table.workspaceId, table.id),
  statusCheck: check('chk_status_catalog', sql`status IN ('CREATED', 'PREPARING', 'ACTIVE', 'STOPPING', 'COMPLETED', 'INTERRUPTED', 'RECOVERABLE', 'FAILED')`),
  durationCheck: check('chk_chunk_duration', sql`chunk_duration_ms > 0`),
  countersCheck: check('chk_counters_positive', sql`total_blocks >= 0 AND total_events >= 0 AND total_readings >= 0 AND total_timeouts >= 0 AND total_disconnects >= 0`),
  sequenceCheck: check('chk_last_sequence', sql`last_committed_sequence IS NULL OR last_committed_sequence >= 0`),
  // Composite FKs to enforce workspace boundaries
  fkVehicleTenant: foreignKey({
    columns: [table.workspaceId, table.vehicleId],
    foreignColumns: [vehicles.workspaceId, vehicles.id],
    name: 'fk_live_sessions_vehicle_tenant'
  }).onDelete('restrict'),
  fkOperatorTenant: foreignKey({
    columns: [table.workspaceId, table.operatorId],
    foreignColumns: [operators.workspaceId, operators.id],
    name: 'fk_live_sessions_operator_tenant'
  }).onDelete('restrict'),
  fkAdapterTenant: foreignKey({
    columns: [table.workspaceId, table.adapterInstanceId],
    foreignColumns: [obdAdapterInstances.workspaceId, obdAdapterInstances.id],
    name: 'fk_live_sessions_adapter_tenant'
  }).onDelete('restrict'),
  fkSnapshotTenant: foreignKey({
    columns: [table.workspaceId, table.capabilitySnapshotId],
    foreignColumns: [vehicleCapabilitySnapshots.workspaceId, vehicleCapabilitySnapshots.id],
    name: 'fk_live_sessions_snapshot_tenant'
  }).onDelete('restrict')
}));

export const telemetryBlocks = sqliteTable('telemetry_blocks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => liveSessions.id, { onDelete: 'cascade' }),
  sequenceNumber: integer('sequence_number').notNull(),
  blockStartMs: integer('block_start_ms').notNull(),
  blockEndMs: integer('block_end_ms').notNull(),
  format: text('format').notNull(),
  formatVersion: text('format_version').notNull(),
  codec: text('codec').notNull(),
  dictionaryVersion: text('dictionary_version').notNull(),
  dictionaryHash: text('dictionary_hash').notNull(),
  eventCount: integer('event_count').notNull(),
  readingCount: integer('reading_count').notNull(),
  payloadLengthBytes: integer('payload_length_bytes').notNull(),
  checksumAlgorithm: text('checksum_algorithm').notNull(),
  checksumValue: text('checksum_value').notNull(),
  payloadBlob: hermesBlob('payload_blob').notNull(),
  commitState: text('commit_state').notNull(), // 'COMMITTED'
  integrityState: text('integrity_state').notNull(), // 'UNCHECKED', 'VALID', 'CORRUPT'

  // V3 Required fields (nullable for V2 legacy compatibility)
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'restrict' }),
  windowIndex: integer('window_index'),
  isPartial: integer('is_partial', { mode: 'boolean' }),
  storageType: text('storage_type'), // 'BLOB'
  firstEventSequence: integer('first_event_sequence'),
  lastEventSequence: integer('last_event_sequence'),
  decoderVersion: text('decoder_version'),

  createdAt: integer('created_at').notNull()
}, (table) => ({
  sessionSequenceIdx: unique('uq_telemetry_blocks_seq').on(table.sessionId, table.sequenceNumber),
  sessionWindowIdx: unique('uq_telemetry_blocks_window').on(table.sessionId, table.windowIndex), // Note: SQLite treats NULLs as distinct, but we'll enforce this
  sessionBlockStartIdx: index('idx_telemetry_blocks_start').on(table.sessionId, table.blockStartMs),
  workspaceStartIdx: index('idx_telemetry_blocks_workspace_start').on(table.workspaceId, table.blockStartMs),
  sequenceCheck: check('chk_sequence_positive', sql`sequence_number >= 0`),
  timeValidCheck: check('chk_block_time_valid', sql`block_end_ms > block_start_ms`),
  eventCountCheck: check('chk_event_count_positive', sql`event_count >= 0`),
  readingCountCheck: check('chk_reading_count_positive', sql`reading_count >= 0`),
  payloadLengthCheck: check('chk_payload_length_positive', sql`payload_length_bytes > 0`),
  blobLengthCheck: check('chk_blob_length', sql`length(payload_blob) = payload_length_bytes`),
  formatCatalogCheck: check('chk_format_catalog', sql`format IN ('JSON', 'BINARY')`),
  integrityCatalogCheck: check('chk_integrity_catalog', sql`integrity_state IN ('VALID', 'CORRUPT')`)
}));

export const liveSessionEvents = sqliteTable('live_session_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => liveSessions.id, { onDelete: 'cascade' }),
  eventSequence: integer('event_sequence').notNull(),
  eventType: text('event_type').notNull(),
  source: text('source').notNull(),
  severity: text('severity').notNull(),
  timestampMs: integer('timestamp_ms').notNull(),
  sessionOffsetMs: integer('session_offset_ms').notNull(),
  detailsSchemaVersion: text('details_schema_version').notNull(),
  detailsJson: text('details_json'),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  sessionTimestampIdx: index('idx_live_session_events_ts').on(table.sessionId, table.timestampMs),
  sessionSequenceIdx: unique('uq_live_session_events_seq').on(table.sessionId, table.eventSequence),
  sequenceCheck: check('chk_event_sequence', sql`event_sequence >= 0`),
  offsetCheck: check('chk_session_offset', sql`session_offset_ms >= 0`)
}));

export const liveSessionSignalSnapshots = sqliteTable('live_session_signal_snapshots', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => liveSessions.id, { onDelete: 'cascade' }),
  signalDefinitionId: text('signal_definition_id').notNull().references(() => signalDefinitions.id, { onDelete: 'restrict' }),
  parameterDefinitionId: text('parameter_definition_id').notNull(), // Ref to obdParameterDefinitions (not enforcing FK to keep simple, or enforce?)
  targetEcu: integer('target_ecu'),
  service: integer('service').notNull(),
  pid: integer('pid').notNull(),
  effectiveUnit: text('effective_unit'),
  numericType: text('numeric_type').notNull(),
  scale: real('scale').notNull(),
  offset: real('offset').notNull(),
  precision: integer('precision').notNull(),
  decoderKey: text('decoder_key').notNull(),
  decoderVersion: text('decoder_version').notNull(),
  origin: text('origin').notNull(),
  priority: text('priority').notNull(),
  targetPeriodMs: integer('target_period_ms').notNull(),
  supportState: text('support_state').notNull(),
  localTargetIndex: integer('local_target_index').notNull(),
  localSignalIndex: integer('local_signal_index').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  sessionLocalSignalIdx: unique('uq_session_local_signal').on(table.sessionId, table.localSignalIndex),
  sessionSignalEcuIdx: unique('uq_session_signal_ecu').on(table.sessionId, table.signalDefinitionId, table.targetEcu)
}));
