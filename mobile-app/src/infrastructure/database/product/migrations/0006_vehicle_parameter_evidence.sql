ALTER TABLE vehicle_capability_parameters
ADD COLUMN standard_definition_state text NOT NULL DEFAULT 'DEFINED';
--> statement-breakpoint
ALTER TABLE vehicle_capability_parameters
ADD COLUMN capability_advertised_state text NOT NULL DEFAULT 'UNKNOWN';
--> statement-breakpoint
ALTER TABLE vehicle_capability_parameters
ADD COLUMN probe_result text NOT NULL DEFAULT 'NOT_PROBED';
--> statement-breakpoint
ALTER TABLE vehicle_capability_parameters
ADD COLUMN live_observation_state text NOT NULL DEFAULT 'NOT_OBSERVED';
