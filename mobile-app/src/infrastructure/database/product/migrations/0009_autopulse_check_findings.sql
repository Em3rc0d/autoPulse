CREATE TABLE `check_findings` (
  `id` text PRIMARY KEY NOT NULL,
  `evaluation_id` text NOT NULL,
  `source` text NOT NULL,
  `status` text NOT NULL,
  `severity` text NOT NULL,
  `confidence` text NOT NULL,
  `evidence_ids_json` text NOT NULL,
  `system_proposal_json` text,
  `professional_review_json` text,
  `technical_explanation` text,
  `client_explanation` text,
  `suggested_action` text,
  `limitations` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`evaluation_id`) REFERENCES `check_evaluations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_check_findings_evaluation` ON `check_findings` (`evaluation_id`);
--> statement-breakpoint
CREATE INDEX `idx_check_findings_status` ON `check_findings` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_check_findings_source` ON `check_findings` (`source`);
