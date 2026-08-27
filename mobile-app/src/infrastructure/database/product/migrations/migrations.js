// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_product_foundation.sql';
import m0001 from './0001_wooden_darwin.sql';
import m0002 from './0002_add_v3_telemetry_block_metadata.sql';
import m0003 from './0003_adapter_capability_snapshots.sql';
import m0004 from './0004_adapter_capability_matched_profile.sql';
import m0005 from './0005_adapter_behavior_assessment.sql';
import m0006 from './0006_vehicle_parameter_evidence.sql';
import m0007 from './0007_raw_vehicle_capability_evidence.sql';
import m0008 from './0008_autopulse_check_evaluations.sql';
import m0009 from './0009_autopulse_check_findings.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
  }
};
