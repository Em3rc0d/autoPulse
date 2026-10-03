import {
  assertValidGoldenReplayCase,
  isReplayCertificationEligible,
} from '../GoldenReplayContract';
import { CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1 } from '../GoldenReplayCertificationCorpusV1';

const first = CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1[0];

describe('CHECK-MK7 GoldenReplayContract', () => {
  it('accepts reviewed GOLDEN cases without elevating them to physical certification', () => {
    expect(() => assertValidGoldenReplayCase(first)).not.toThrow();
    expect(isReplayCertificationEligible(first)).toBe(true);
    expect(first.promotionState).toBe('GOLDEN');
    expect(first.claims).not.toContain('PHYSICAL_TRANSPORT');
    expect(first.claims).not.toContain('PHYSICAL_TIMING');
  });

  it('rejects GOLDEN promotion when expected truth is not independently sourced', () => {
    expect(() => assertValidGoldenReplayCase({
      ...first,
      caseId: 'self-certified-invalid',
      evidence: first.evidence.map(item => ({ ...item, independentFromParserOutput: false })),
    })).toThrow('claim SERVICE_SEMANTICS lacks independent supporting evidence');
  });

  it('requires independent evidence for every bounded GOLDEN claim', () => {
    expect(() => assertValidGoldenReplayCase({
      ...first,
      caseId: 'unbacked-claim-invalid',
      claims: ['SERVICE_SEMANTICS', 'ENGINE_CONTROL_FLOW'],
    })).toThrow('claim ENGINE_CONTROL_FLOW lacks independent supporting evidence');
  });

  it('rejects physical claims from a reference or synthetic case', () => {
    expect(() => assertValidGoldenReplayCase({
      ...first,
      caseId: 'fake-physical-claim',
      claims: ['SERVICE_SEMANTICS', 'PHYSICAL_TRANSPORT'],
    })).toThrow('cannot make a physical claim');
  });

  it('requires raw hashed capture evidence for PHYSICALLY_CERTIFIED', () => {
    expect(() => assertValidGoldenReplayCase({
      ...first,
      caseId: 'fake-physical-certification',
      sourceType: 'PHYSICAL_CAPTURE',
      promotionState: 'PHYSICALLY_CERTIFIED',
      claims: ['PHYSICAL_TRANSPORT'],
    })).toThrow('requires a SHA-256 raw evidence digest');
  });

  it('keeps every certified V1 replay case non-physical and independently supported per claim', () => {
    for (const candidate of CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1) {
      expect(() => assertValidGoldenReplayCase(candidate)).not.toThrow();
      expect(candidate.promotionState).toBe('GOLDEN');
      expect(candidate.claims).not.toContain('PHYSICAL_TRANSPORT');
      expect(candidate.claims).not.toContain('PHYSICAL_TIMING');
    }
  });
});
