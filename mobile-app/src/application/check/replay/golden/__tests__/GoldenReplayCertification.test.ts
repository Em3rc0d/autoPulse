import { certifyGoldenReplayCorpus } from '../GoldenReplayCertification';
import { CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1 } from '../GoldenReplayCertificationCorpusV1';

describe('CHECK-MK9 golden replay certification', () => {
  it('certifies every promoted V1 replay case against independently reviewed expectations', async () => {
    const receipt = await certifyGoldenReplayCorpus(CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1);

    expect(receipt.status).toBe('PASS');
    expect(receipt.eligibleCases).toBe(CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1.length);
    expect(receipt.passedCases).toBe(CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1.length);
    expect(receipt.cases.every(item => item.eligible && item.passed)).toBe(true);
  });

  it('covers Core replay semantics, responder truth and endpoint-scoped PID capability before a physical pilot', () => {
    const ids = new Set(CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1.map(item => item.caseId));
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
      'golden-multiple-stored-dtcs',
      'golden-duplicate-dtc-normalization',
      'golden-positive-empty-dtc-fails-closed',
      'golden-partial-dtc-remains-partial',
      'golden-unsupported-dtc-is-not-zero',
      'golden-attributed-single-responder',
      'golden-multi-responder-attributed',
      'golden-unattributed-response',
      'golden-source-ambiguity-stays-unattributed',
      'golden-mixed-responder-outcomes-limited',
      'golden-pid-support-multi-endpoint',
      'golden-pid-support-unattributed-stays-unattributed',
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it('does not smuggle physical transport/timing certification into the replay corpus', () => {
    for (const candidate of CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1) {
      expect(candidate.promotionState).toBe('GOLDEN');
      expect(candidate.claims).not.toContain('PHYSICAL_TRANSPORT');
      expect(candidate.claims).not.toContain('PHYSICAL_TIMING');
    }
  });
});
