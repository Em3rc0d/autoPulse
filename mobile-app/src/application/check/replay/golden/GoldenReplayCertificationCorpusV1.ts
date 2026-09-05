import type { GoldenReplayCase } from './GoldenReplayContract';
import { CHECK_GOLDEN_ENDPOINT_CASES_V1 } from './GoldenEndpointReplayCasesV1';
import { CHECK_GOLDEN_REPLAY_CASES_V1 } from './GoldenReplayCorpusV1';

/**
 * Complete CHECK-MK7 replay-certification corpus. This intentionally contains
 * no PHYSICALLY_CERTIFIED cases; physical transport/timing promotion is a
 * separate evidence gate.
 */
export const CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1: readonly GoldenReplayCase[] = Object.freeze([
  ...CHECK_GOLDEN_REPLAY_CASES_V1,
  ...CHECK_GOLDEN_ENDPOINT_CASES_V1,
]);
