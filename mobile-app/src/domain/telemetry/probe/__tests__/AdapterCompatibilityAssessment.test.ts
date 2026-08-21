import {
  AdapterBehaviorEvidence,
  AdapterCompatibilityClassifier,
} from '../AdapterCompatibilityAssessment';

const baseEvidence = (overrides: Partial<AdapterBehaviorEvidence> = {}): AdapterBehaviorEvidence => ({
  profileMatch: 'NO_PROFILE_MATCH',
  writeAccepted: true,
  responseReceived: true,
  protocolResponseValid: true,
  promptDetected: true,
  timedOut: false,
  disconnectObserved: false,
  latencyMs: 120,
  receiveMode: 'NOTIFY',
  writeMode: 'WITH_RESPONSE',
  ...overrides,
});

describe('AdapterCompatibilityClassifier', () => {
  it('certifies an exact known profile only when behavior is proven', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      profileMatch: 'EXACT_PROFILE_MATCH',
    }))).toEqual({
      grade: 'CERTIFIED',
      reasons: ['EXACT_PROFILE_AND_BEHAVIOR_VERIFIED'],
    });
  });

  it('grades an unknown generic adapter as compatible when behavior is proven', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence())).toEqual({
      grade: 'COMPATIBLE',
      reasons: ['GENERIC_BEHAVIOR_VERIFIED'],
    });
  });

  it('does not let an exact profile rescue a missing protocol response', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      profileMatch: 'EXACT_PROFILE_MATCH',
      responseReceived: false,
      protocolResponseValid: false,
      promptDetected: false,
    })).grade).toBe('UNSUPPORTED');
  });

  it('grades valid but prompt-less behavior as degraded', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      promptDetected: false,
    }))).toEqual({
      grade: 'DEGRADED',
      reasons: ['PROMPT_NOT_OBSERVED'],
    });
  });

  it('grades read-polling fallback as degraded even with a valid response', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      receiveMode: 'READ',
    }))).toEqual({
      grade: 'DEGRADED',
      reasons: ['READ_POLLING_FALLBACK'],
    });
  });

  it('rejects a disconnect observed during probe', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      disconnectObserved: true,
    }))).toEqual({
      grade: 'UNSUPPORTED',
      reasons: ['DISCONNECTED_DURING_PROBE'],
    });
  });
});
