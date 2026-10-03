import {
  assertValidGoldenReplayCase,
  type GoldenReplayCase,
} from '../GoldenReplayContract';
import {
  certifyGoldenReplayCase,
  certifyGoldenReplayCorpus,
} from '../GoldenReplayCertification';
import { CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1 } from '../GoldenReplayCertificationCorpusV1';

const first = CHECK_GOLDEN_REPLAY_CERTIFICATION_CORPUS_V1[0];

function withCase(overrides: Partial<GoldenReplayCase>): GoldenReplayCase {
  return { ...first, ...overrides };
}

describe('CHECK-MK9 golden promotion hardening', () => {
  it('does not allow physical claims at GOLDEN promotion even from a physical source', () => {
    const physicalEvidence = {
      evidenceId: 'physical-capture-ref',
      kind: 'PHYSICAL_RAW_CAPTURE' as const,
      locator: 'fixture://physical/raw',
      supports: ['PHYSICAL_TRANSPORT' as const],
      independentFromParserOutput: true,
    };
    expect(() => assertValidGoldenReplayCase(withCase({
      caseId: 'physical-claim-without-physical-promotion',
      sourceType: 'PHYSICAL_CAPTURE',
      promotionState: 'GOLDEN',
      claims: ['PHYSICAL_TRANSPORT'],
      evidence: [physicalEvidence],
      rawEvidenceSha256: 'a'.repeat(64),
    }))).toThrow('physical claims require PHYSICALLY_CERTIFIED promotion');
  });

  it('does not allow PHYSICALLY_CERTIFIED without an explicit physical claim', () => {
    expect(() => assertValidGoldenReplayCase(withCase({
      caseId: 'physical-state-without-physical-claim',
      sourceType: 'PHYSICAL_CAPTURE',
      promotionState: 'PHYSICALLY_CERTIFIED',
      rawEvidenceSha256: 'b'.repeat(64),
    }))).toThrow('requires at least one physical claim');
  });

  it('validates raw capture digests whenever present, not only at physical promotion', () => {
    expect(() => assertValidGoldenReplayCase(withCase({
      caseId: 'invalid-optional-digest',
      rawEvidenceSha256: 'not-a-sha256',
    }))).toThrow('64-character hexadecimal SHA-256');
  });

  it('rejects duplicate evidence identities within a promoted case', () => {
    expect(() => assertValidGoldenReplayCase(withCase({
      caseId: 'duplicate-evidence-id',
      evidence: [first.evidence[0], first.evidence[0]],
    }))).toThrow('evidence IDs contains duplicates');
  });

  it('rejects duplicate case identities in the certification corpus', async () => {
    await expect(certifyGoldenReplayCorpus([first, first])).rejects.toThrow('duplicate caseIds');
  });

  it('fails certification when a fixture contains scripted evidence the scan ignored', async () => {
    const originalScript = first.fixture.scripts[0];
    const extraEvent = {
      ...originalScript.events[0],
      kind: 'COMMAND_RESPONSE' as const,
      durationMs: 10,
    };
    const candidate = withCase({
      caseId: 'golden-unconsumed-evidence-must-fail',
      fixture: {
        ...first.fixture,
        fixtureId: 'golden-unconsumed-evidence-must-fail-fixture',
        scripts: [
          { ...originalScript, events: [...originalScript.events, extraEvent] },
          ...first.fixture.scripts.slice(1),
        ],
      },
    });

    const receipt = await certifyGoldenReplayCase(candidate);
    expect(receipt.passed).toBe(false);
    expect(receipt.mismatches.some(item => item.includes('unconsumed evidence'))).toBe(true);
  });
});
