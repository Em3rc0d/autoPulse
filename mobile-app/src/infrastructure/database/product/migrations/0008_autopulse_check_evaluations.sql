CREATE TABLE `check_evaluations` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `vehicle_id` text NOT NULL,
  `operator_id` text NOT NULL,
  `state` text NOT NULL,
  `purpose` text NOT NULL,
  `scope_json` text NOT NULL,
  `limitations` text,
  `symptoms` text,
  `created_at` integer NOT NULL,
  `opened_at` integer,
  `signed_at` integer,
  `cancelled_at` integer,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_check_evaluations_workspace` ON `check_evaluations` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_evaluations_vehicle` ON `check_evaluations` (`vehicle_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_evaluations_state` ON `check_evaluations` (`state`);
--> statement-breakpoint
CREATE INDEX `idx_check_evaluations_created` ON `check_evaluations` (`created_at`);
--> statement-breakpoint
CREATE TABLE `check_evidence_items` (
  `id` text PRIMARY KEY NOT NULL,
  `evaluation_id` text NOT NULL,
  `live_session_id` text,
  `origin` text NOT NULL,
  `type` text NOT NULL,
  `state` text NOT NULL,
  `captured_at` integer NOT NULL,
  `content_hash` text,
  `local_reference` text,
  `metadata_json` text,
  `time_window_start_ms` integer,
  `time_window_end_ms` integer,
  `created_by` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`evaluation_id`) REFERENCES `check_evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`live_session_id`) REFERENCES `live_sessions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_check_evidence_evaluation` ON `check_evidence_items` (`evaluation_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_evidence_live_session` ON `check_evidence_items` (`live_session_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_evidence_origin` ON `check_evidence_items` (`origin`);
