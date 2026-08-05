ALTER TABLE `vehicle_capability_parameters` ADD `evidence_origin` text DEFAULT 'UNKNOWN' NOT NULL;
--> statement-breakpoint

-- Backfill existing capabilities to the new 3-dimensional contract
UPDATE `vehicle_capability_parameters`
SET 
  `evidence_origin` = CASE 
    WHEN `support_state` = 'DIRECTLY_OBSERVED' THEN 'DIRECT_OBSERVATION'
    WHEN `support_state` = 'SUPPORTED' AND (SELECT `protocol_code` FROM `vehicle_capability_snapshots` WHERE `id` = `snapshot_id`) IN ('REPLAY_SIMULATED', 'REPLAY_FIXTURE') THEN 'REPLAY_FIXTURE'
    WHEN `support_state` IN ('SUPPORTED', 'NOT_SUPPORTED') THEN 'BITMAP'
    WHEN `support_state` IN ('NOT_AVAILABLE', 'NO_RESPONSE', 'TEMPORARILY_UNAVAILABLE', 'NOT_TESTED') THEN 'PROBE'
    ELSE 'UNKNOWN'
  END,
  
  `discovery_outcome` = CASE
    WHEN `support_state` IN ('DIRECTLY_OBSERVED', 'SUPPORTED', 'NOT_SUPPORTED') THEN 'SUCCESS'
    WHEN `support_state` = 'NO_RESPONSE' THEN 'NO_RESPONSE'
    WHEN `support_state` IN ('NOT_AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'NOT_TESTED') THEN 'NOT_ATTEMPTED'
    ELSE `discovery_outcome`
  END,
  
  `support_state` = CASE
    WHEN `support_state` = 'DIRECTLY_OBSERVED' THEN 'SUPPORTED'
    WHEN `support_state` = 'SUPPORTED' THEN 'SUPPORTED'
    WHEN `support_state` = 'NOT_SUPPORTED' THEN 'NOT_SUPPORTED'
    WHEN `support_state` IN ('NOT_AVAILABLE', 'NO_RESPONSE', 'TEMPORARILY_UNAVAILABLE', 'NOT_TESTED') THEN 'UNKNOWN'
    ELSE `support_state`
  END;
