ALTER TABLE `check_evaluations` ADD `coverage_json` text;
--> statement-breakpoint
CREATE TABLE `check_report_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `evaluation_id` text NOT NULL,
  `state` text NOT NULL,
  `visible_finding_ids_json` text NOT NULL,
  `selected_evidence_ids_json` text NOT NULL,
  `custom_recommendations` text,
  `draft_notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`evaluation_id`) REFERENCES `check_evaluations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_check_report_drafts_evaluation` ON `check_report_drafts` (`evaluation_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_report_drafts_state` ON `check_report_drafts` (`state`);
--> statement-breakpoint
CREATE TABLE `check_report_manifests` (
  `id` text PRIMARY KEY NOT NULL,
  `evaluation_id` text NOT NULL,
  `manifest_json` text NOT NULL,
  `canonical_payload` text NOT NULL,
  `integrity_hash` text NOT NULL,
  `generated_at` integer NOT NULL,
  FOREIGN KEY (`evaluation_id`) REFERENCES `check_evaluations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_check_report_manifests_evaluation` ON `check_report_manifests` (`evaluation_id`);
--> statement-breakpoint
CREATE TABLE `check_report_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `evaluation_id` text NOT NULL,
  `version_number` integer NOT NULL,
  `state` text NOT NULL,
  `manifest_id` text NOT NULL,
  `integrity_hash` text NOT NULL,
  `signed_by` text NOT NULL,
  `signed_at` integer NOT NULL,
  `supersedes_version_id` text,
  `void_reason` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`evaluation_id`) REFERENCES `check_evaluations`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`manifest_id`) REFERENCES `check_report_manifests`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`signed_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_check_report_versions_evaluation` ON `check_report_versions` (`evaluation_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_report_versions_state` ON `check_report_versions` (`state`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_check_report_version_number` ON `check_report_versions` (`evaluation_id`,`version_number`);
