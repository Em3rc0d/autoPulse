CREATE TABLE vehicle_check_reports (
  id text PRIMARY KEY NOT NULL,
  workspace_id text NOT NULL,
  vehicle_id text NOT NULL,
  session_id text NOT NULL,
  schema_version text NOT NULL,
  state text NOT NULL DEFAULT 'FINAL',
  snapshot_json text NOT NULL,
  canonical_json text NOT NULL,
  sha256 text NOT NULL,
  generated_at integer NOT NULL,
  created_at integer NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE restrict,
  FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE cascade,
  FOREIGN KEY (workspace_id, vehicle_id) REFERENCES vehicles(workspace_id, id) ON DELETE restrict,
  CONSTRAINT chk_vehicle_check_report_state CHECK (state IN ('FINAL')),
  CONSTRAINT chk_vehicle_check_report_sha256 CHECK (length(sha256) = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX uq_vehicle_check_reports_tenant ON vehicle_check_reports (workspace_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX uq_vehicle_check_reports_session ON vehicle_check_reports (session_id);
--> statement-breakpoint
CREATE INDEX idx_vehicle_check_reports_vehicle_generated ON vehicle_check_reports (vehicle_id, generated_at);
