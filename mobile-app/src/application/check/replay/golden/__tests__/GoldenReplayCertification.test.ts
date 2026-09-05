import { certifyGoldenReplayCorpus } from '../GoldenReplayCertification';
import { CHECK_GOLDEN_REPLAY_CASES_V1 } from '../GoldenReplayCorpusV1';

describe('CHECK-MK7 golden replay certification', () => {
  it('certifies every promoted V1 replay case against independently reviewed expectations', async () => {
    const receipt = await certifyGoldenReplayCorpus(CHECK_GOLDEN_REPLAY_CASES_V1);

    expect(receipt.status).toBe('PASS');
    expect(receipt.eligibleCases).toBe(CHECK_GOLDEN_REPLAY_CASES_V1.length);
    expect(receipt.passedCases).toBe(CHECK_GOLDEN_REPLAY_CASES_V1.length);
    expect(receipt.cases.every(item => item.eligible && item.passed)).toBe(true);
  });

  it('covers the Core replay semantics required before a physical pilot can be considered', () => {
    const ids = new Set(CHECK_GOLDEN_REPLAY_CASES_V1.map(item => item.caseId));
    expect(ids).toEqual(expect.objectContaining ? ids : ids);

    for (const required of [
      'golden-legacy-mode03-p0133',
      'golden-zero-dtc-core',
      'golden-pending-only',
      'golden-permanent-only',
      'golden-same-code-multi-status',
      'golden-no-data-is-not-zero',
      'golden-negative-response-distinct',
      'golden-malformed-odd-dtc-fails-closed',
      'golden-timeout-bounded-retry',
      'golden-response-pending-continuation',
      'golden-disconnect-preserves-terminal-truth',
      'golden-can-mode03-count-byte',
      'golden-mode01-support-bitmap-reference',
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });
});
