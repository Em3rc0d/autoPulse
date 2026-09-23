import type { GoldenReplayCase } from './GoldenReplayContract';
import { CHECK_GOLDEN_DTC_EDGE_CASES_V1 } from './GoldenDtcEdgeReplayCasesV1';
import { CHECK_GOLDEN_ENDPOINT_CASES_V1 } from './GoldenEndpointReplayCasesV1';
import { CHECK_GOLDEN_PID_SUPPORT_ENDPOINT_CASES_V1 } from './GoldenPidSupportEndpointCasesV1';
import { CHECK_GOLDEN_REPLAY_CASES_V1 } from './GoldenReplayCorpusV1';

/** Complete non-physical CHECK replay-certification corpus. */
export const CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1: readonly GoldenReplayCase[] = Object.freeze([
  ...CHECK_GOLDEN_REPLAY_CASES_V1,
  ...CHECK_GOLDEN_DTC_EDGE_CASES_V1,
  ...CHECK_GOLDEN_ENDPOINT_CASES_V1,
  ...CHECK_GOLDEN_PID_SUPPORT_ENDPOINT_CASES_V1,
]);
