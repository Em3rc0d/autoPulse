CREATE TABLE vehicle_capability_parameters_v2 (
  id text PRIMARY KEY NOT NULL,
  snapshot_id text NOT NULL,
  ecu_address integer NOT NULL,
  observed_request_id text NOT NULL,
  parameter_definition_id text,
  support_state text NOT NULL,
  discovery_outcome text NOT NULL,
  standard_definition_state text NOT NULL DEFAULT 'DEFINED',
  capability_advertised_state text NOT NULL DEFAULT 'UNKNOWN',
  probe_result text NOT NULL DEFAULT 'NOT_PROBED',
  live_observation_state text NOT NULL DEFAULT 'NOT_OBSERVED',
  error_code text,
  discovered_at integer NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES vehicle_capability_snapshots(id) ON DELETE cascade,
  FOREIGN KEY (parameter_definition_id) REFERENCES obd_parameter_definitions(id) ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO vehicle_capability_parameters_v2 (
  id,
  snapshot_id,
  ecu_address,
  observed_request_id,
  parameter_definition_id,
  support_state,
  discovery_outcome,
  standard_definition_state,
  capability_advertised_state,
  probe_result,
  live_observation_state,
  error_code,
  discovered_at
)
SELECT
  id,
  snapshot_id,
  ecu_address,
  parameter_definition_id,
  parameter_definition_id,
  support_state,
  discovery_outcome,
  standard_definition_state,
  capability_advertised_state,
  probe_result,
  live_observation_state,
  error_code,
  discovered_at
FROM vehicle_capability_parameters;
--> statement-breakpoint
DROP TABLE vehicle_capability_parameters;
--> statement-breakpoint
ALTER TABLE vehicle_capability_parameters_v2 RENAME TO vehicle_capability_parameters;
--> statement-breakpoint
CREATE UNIQUE INDEX uq_capability_params
ON vehicle_capability_parameters (snapshot_id, ecu_address, observed_request_id);
