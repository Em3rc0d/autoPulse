UPDATE `telemetry_blocks` SET `workspace_id` = (SELECT `workspace_id` FROM `live_sessions` WHERE `live_sessions`.`id` = `telemetry_blocks`.`session_id`) WHERE `workspace_id` IS NULL;--> statement-breakpoint
UPDATE `telemetry_blocks` SET `storage_type` = 'BLOB' WHERE `storage_type` IS NULL;--> statement-breakpoint
UPDATE `telemetry_blocks` SET `is_partial` = 0 WHERE `is_partial` IS NULL;
