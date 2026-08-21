CREATE TABLE `obd_adapter_capability_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `adapter_instance_id` text NOT NULL,
  `observed_at` integer NOT NULL,
  `transport_type` text NOT NULL,
  `profile_match` text NOT NULL,
  `compatibility_grade` text NOT NULL,
  `compatibility_reasons_json` text NOT NULL,
  `evidence_schema_version` text NOT NULL,
  `evidence_json` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`adapter_instance_id`) REFERENCES `obd_adapter_instances`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_adapter_capability_snapshots_workspace_adapter_observed` ON `obd_adapter_capability_snapshots` (`workspace_id`,`adapter_instance_id`,`observed_at`);
--> statement-breakpoint
CREATE INDEX `idx_adapter_capability_snapshots_adapter_observed` ON `obd_adapter_capability_snapshots` (`adapter_instance_id`,`observed_at`);
