ALTER TABLE `telemetry_blocks` ADD `workspace_id` text REFERENCES workspaces(id);--> statement-breakpoint
ALTER TABLE `telemetry_blocks` ADD `window_index` integer;--> statement-breakpoint
ALTER TABLE `telemetry_blocks` ADD `is_partial` integer;--> statement-breakpoint
ALTER TABLE `telemetry_blocks` ADD `storage_type` text;--> statement-breakpoint
ALTER TABLE `telemetry_blocks` ADD `first_event_sequence` integer;--> statement-breakpoint
ALTER TABLE `telemetry_blocks` ADD `last_event_sequence` integer;--> statement-breakpoint
ALTER TABLE `telemetry_blocks` ADD `decoder_version` text;--> statement-breakpoint
CREATE INDEX `idx_telemetry_blocks_workspace_start` ON `telemetry_blocks` (`workspace_id`,`block_start_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_telemetry_blocks_window` ON `telemetry_blocks` (`session_id`,`window_index`) WHERE `window_index` IS NOT NULL;