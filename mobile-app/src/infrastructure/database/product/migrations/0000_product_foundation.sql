CREATE TABLE `database_identity` (
	`database_kind` text NOT NULL,
	`schema_generation` text NOT NULL,
	`installation_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `local_app_context` (
	`singleton_key` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`installation_id` text NOT NULL,
	`default_workspace_id` text NOT NULL,
	`default_operator_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`default_workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`default_operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `chk_singleton_key` CHECK(singleton_key = 1)
);
--> statement-breakpoint
CREATE TABLE `operators` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`alias` text NOT NULL,
	`vin` text,
	`make` text,
	`model` text,
	`year` integer,
	`license_plate` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `obd_adapter_compatibility_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`adapter_model_id` text NOT NULL,
	`profile_version` text NOT NULL,
	`compatibility_status` text NOT NULL,
	`transport_type` text NOT NULL,
	`service_fingerprint` text,
	`write_characteristic` text,
	`notify_characteristic` text,
	`write_mode` text,
	`framing_profile` text,
	`initialization_profile` text,
	`firmware_constraints` text,
	`profile_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`adapter_model_id`) REFERENCES `obd_adapter_models`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `obd_adapter_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`adapter_model_id` text,
	`alias` text,
	`platform_device_id` text NOT NULL,
	`advertised_name` text,
	`last_service_fingerprint` text,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`last_successful_connection` integer,
	`reported_firmware` text,
	`trust_state` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	`last_transport_type` text,
	`last_compatibility_profile_id` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`adapter_model_id`) REFERENCES `obd_adapter_models`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`last_compatibility_profile_id`) REFERENCES `obd_adapter_compatibility_profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `obd_adapter_models` (
	`id` text PRIMARY KEY NOT NULL,
	`manufacturer` text,
	`model_name` text NOT NULL,
	`transport_family` text NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `vehicle_capability_ecus` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`ecu_address` integer NOT NULL,
	`ecu_role` text,
	`first_response_timestamp` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `vehicle_capability_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vehicle_capability_parameters` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`ecu_address` integer NOT NULL,
	`parameter_definition_id` text NOT NULL,
	`support_state` text NOT NULL,
	`discovery_outcome` text NOT NULL,
	`error_code` text,
	`discovered_at` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `vehicle_capability_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parameter_definition_id`) REFERENCES `obd_parameter_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `vehicle_capability_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`adapter_instance_id` text NOT NULL,
	`compatibility_profile_version` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`protocol_code` text NOT NULL,
	`decoder_catalog_version` text NOT NULL,
	`discovery_status` text NOT NULL,
	`raw_discovery_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`,`vehicle_id`) REFERENCES `vehicles`(`workspace_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`workspace_id`,`adapter_instance_id`) REFERENCES `obd_adapter_instances`(`workspace_id`,`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `obd_parameter_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`service` integer NOT NULL,
	`parameter_identifier` integer NOT NULL,
	`technical_name` text NOT NULL,
	`capability_range` text,
	`request_version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signal_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`parameter_definition_id` text NOT NULL,
	`signal_key` text NOT NULL,
	`name` text NOT NULL,
	`canonical_unit` text,
	`numeric_type` text NOT NULL,
	`decoder_key` text NOT NULL,
	`decoder_version` text NOT NULL,
	`scale` real DEFAULT 1 NOT NULL,
	`offset` real DEFAULT 0 NOT NULL,
	`precision` integer DEFAULT 0 NOT NULL,
	`default_priority` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`parameter_definition_id`) REFERENCES `obd_parameter_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `live_session_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`source` text NOT NULL,
	`severity` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`session_offset_ms` integer NOT NULL,
	`details_schema_version` text NOT NULL,
	`details_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `chk_event_sequence` CHECK(event_sequence >= 0),
	CONSTRAINT `chk_session_offset` CHECK(session_offset_ms >= 0)
);
--> statement-breakpoint
CREATE TABLE `live_session_signal_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`signal_definition_id` text NOT NULL,
	`parameter_definition_id` text NOT NULL,
	`target_ecu` integer,
	`service` integer NOT NULL,
	`pid` integer NOT NULL,
	`effective_unit` text,
	`numeric_type` text NOT NULL,
	`scale` real NOT NULL,
	`offset` real NOT NULL,
	`precision` integer NOT NULL,
	`decoder_key` text NOT NULL,
	`decoder_version` text NOT NULL,
	`origin` text NOT NULL,
	`priority` text NOT NULL,
	`target_period_ms` integer NOT NULL,
	`support_state` text NOT NULL,
	`local_target_index` integer NOT NULL,
	`local_signal_index` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signal_definition_id`) REFERENCES `signal_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`operator_id` text NOT NULL,
	`adapter_instance_id` text NOT NULL,
	`capability_snapshot_id` text,
	`adapter_profile_version` text,
	`adapter_firmware_version` text,
	`decoder_catalog_version` text,
	`format` text NOT NULL,
	`format_version` text NOT NULL,
	`codec` text NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`status` text NOT NULL,
	`stop_reason` text,
	`failure_code` text,
	`recovered_at` integer,
	`completed_at` integer,
	`protocol_code` text,
	`transport_type` text,
	`chunk_duration_ms` integer NOT NULL,
	`dictionary_version` text NOT NULL,
	`last_committed_sequence` integer,
	`total_blocks` integer DEFAULT 0 NOT NULL,
	`total_events` integer DEFAULT 0 NOT NULL,
	`total_readings` integer DEFAULT 0 NOT NULL,
	`total_timeouts` integer DEFAULT 0 NOT NULL,
	`total_disconnects` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`workspace_id`,`vehicle_id`) REFERENCES `vehicles`(`workspace_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`workspace_id`,`operator_id`) REFERENCES `operators`(`workspace_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`workspace_id`,`adapter_instance_id`) REFERENCES `obd_adapter_instances`(`workspace_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`workspace_id`,`capability_snapshot_id`) REFERENCES `vehicle_capability_snapshots`(`workspace_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT `chk_status_catalog` CHECK(status IN ('CREATED', 'PREPARING', 'ACTIVE', 'STOPPING', 'COMPLETED', 'INTERRUPTED', 'RECOVERABLE', 'FAILED')),
	CONSTRAINT `chk_chunk_duration` CHECK(chunk_duration_ms > 0),
	CONSTRAINT `chk_counters_positive` CHECK(total_blocks >= 0 AND total_events >= 0 AND total_readings >= 0 AND total_timeouts >= 0 AND total_disconnects >= 0),
	CONSTRAINT `chk_last_sequence` CHECK(last_committed_sequence IS NULL OR last_committed_sequence >= 0)
);
--> statement-breakpoint
CREATE TABLE `telemetry_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`block_start_ms` integer NOT NULL,
	`block_end_ms` integer NOT NULL,
	`format` text NOT NULL,
	`format_version` text NOT NULL,
	`codec` text NOT NULL,
	`dictionary_version` text NOT NULL,
	`dictionary_hash` text NOT NULL,
	`event_count` integer NOT NULL,
	`reading_count` integer NOT NULL,
	`payload_length_bytes` integer NOT NULL,
	`checksum_algorithm` text NOT NULL,
	`checksum_value` text NOT NULL,
	`payload_blob` blob NOT NULL,
	`commit_state` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `chk_sequence_positive` CHECK(sequence_number >= 0),
	CONSTRAINT `chk_block_time_valid` CHECK(block_end_ms > block_start_ms),
	CONSTRAINT `chk_event_count_positive` CHECK(event_count >= 0),
	CONSTRAINT `chk_reading_count_positive` CHECK(reading_count >= 0),
	CONSTRAINT `chk_payload_length_positive` CHECK(payload_length_bytes > 0),
	CONSTRAINT `chk_blob_length` CHECK(length(payload_blob) = payload_length_bytes),
	CONSTRAINT `chk_format_catalog` CHECK(format IN ('JSON', 'BINARY')),
	CONSTRAINT `chk_integrity_catalog` CHECK(integrity_state IN ('VALID', 'CORRUPT'))
);
--> statement-breakpoint
CREATE INDEX `idx_operators_workspace` ON `operators` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_operators_tenant` ON `operators` (`workspace_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_workspace` ON `vehicles` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_workspace_created` ON `vehicles` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vehicles_tenant` ON `vehicles` (`workspace_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_adapter_instances_last_seen` ON `obd_adapter_instances` (`workspace_id`,`last_seen`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_adapter_instances_platform` ON `obd_adapter_instances` (`workspace_id`,`platform_device_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_adapter_instances_tenant` ON `obd_adapter_instances` (`workspace_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capability_params` ON `vehicle_capability_parameters` (`snapshot_id`,`ecu_address`,`parameter_definition_id`);--> statement-breakpoint
CREATE INDEX `idx_capability_snapshots_workspace` ON `vehicle_capability_snapshots` (`workspace_id`,`vehicle_id`,`discovered_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capability_snapshots_tenant` ON `vehicle_capability_snapshots` (`workspace_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_obd_parameter_def` ON `obd_parameter_definitions` (`namespace`,`service`,`parameter_identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_signal_def` ON `signal_definitions` (`parameter_definition_id`,`signal_key`,`decoder_version`);--> statement-breakpoint
CREATE INDEX `idx_live_session_events_ts` ON `live_session_events` (`session_id`,`timestamp_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_live_session_events_seq` ON `live_session_events` (`session_id`,`event_sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_session_local_signal` ON `live_session_signal_snapshots` (`session_id`,`local_signal_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_session_signal_ecu` ON `live_session_signal_snapshots` (`session_id`,`signal_definition_id`,`target_ecu`);--> statement-breakpoint
CREATE INDEX `idx_live_sessions_workspace_started` ON `live_sessions` (`workspace_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_live_sessions_vehicle_started` ON `live_sessions` (`vehicle_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_live_sessions_workspace_status` ON `live_sessions` (`workspace_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_live_sessions_tenant` ON `live_sessions` (`workspace_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_telemetry_blocks_start` ON `telemetry_blocks` (`session_id`,`block_start_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_telemetry_blocks_seq` ON `telemetry_blocks` (`session_id`,`sequence_number`);