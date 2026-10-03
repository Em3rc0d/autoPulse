CREATE TABLE diagnostic_check_reports (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  vehicle_id text NOT NULL,
  schema_version text NOT NULL,
  pilot_version text NOT NULL,
  protocol text NOT NULL,
  state text NOT NULL DEFAULT 'FINAL',
  snapshot_json text NOT NULL,
  canonical_json text NOT NULL,
  sha256 text NOT NULL,
  generated_at integer NOT NULL,
  created_at integer NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE restrict,
  FOREIGN KEY (workspace_id, vehicle_id) REFERENCES vehicles(workspace_id, id) ON DELETE restrict,
  CONSTRAINT chk_diagnostic_check_report_state CHECK (state IN ('FINAL')),
  CONSTRAINT chk_diagnostic_check_report_sha256 CHECK (length(sha256) = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX uq_diagnostic_check_reports_tenant ON diagnostic_check_reports (workspace_id, id);
--> statement-breakpoint
CREATE INDEX idx_diagnostic_check_reports_vehicle_generated ON diagnostic_check_reports (vehicle_id, generated_at);
