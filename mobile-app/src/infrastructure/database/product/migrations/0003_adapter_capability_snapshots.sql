CREATE TABLE `adapter_capability_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `adapter_instance_id` text NOT NULL,
  `schema_version` text NOT NULL,
  `transport` text NOT NULL,
  `device_id` text NOT NULL,
  `device_name` text,
  `rssi` integer,
  `profile_match` text NOT NULL,
  `compatibility_grade` text NOT NULL,
  `write_characteristic_uuid` text,
  `receive_characteristic_uuid` text,
  `tested_combination_count` integer NOT NULL,
  `command_used` text,
  `sanitized_response` text,
  `bytes_written` integer,
  `latency_ms` integer,
  `echo_observed` integer,
  `prompt_observed` integer,
  `probe_stage` text NOT NULL,
  `failure_reason` text,
  `connection_retained` integer NOT NULL,
  `assessed_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  CONSTRAINT `fk_adapter_capability_snapshot_adapter_tenant`
    FOREIGN KEY (`workspace_id`,`adapter_instance_id`)
    REFERENCES `obd_adapter_instances`(`workspace_id`,`id`)
    ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `idx_adapter_capability_snapshots_workspace_adapter_assessed`
  ON `adapter_capability_snapshots` (`workspace_id`,`adapter_instance_id`,`assessed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_adapter_capability_snapshots_tenant`
  ON `adapter_capability_snapshots` (`workspace_id`,`id`);
