import {
  AdapterBehaviorEvidence,
  AdapterCompatibilityClassifier,
} from '../AdapterCompatibilityAssessment';
import type { AdapterInitializationCheck } from '../AdapterInitializationBehavior';

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

const preferredCheck = (overrides: Partial<AdapterInitializationCheck> = {}): AdapterInitializationCheck => ({
  behavior: 'SPACES_CONTROL',
  requirement: 'PREFERRED',
  command: 'ATS0',
  outcome: 'ACKNOWLEDGED',
  response: 'OK',
  latencyMs: 40,
  timedOut: false,
  promptDetected: true,
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

  it('degrades a preferred formatting command rejection instead of rejecting the adapter', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      initializationChecks: [preferredCheck({ outcome: 'REJECTED', response: '?' })],
    }))).toEqual({
      grade: 'DEGRADED',
      reasons: ['PREFERRED_BEHAVIOR_UNAVAILABLE:SPACES_CONTROL:REJECTED'],
    });
  });

  it('degrades an acknowledged preferred behavior when prompt reliability is poor', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      initializationChecks: [preferredCheck({ timedOut: true, promptDetected: false })],
    }))).toEqual({
      grade: 'DEGRADED',
      reasons: ['PREFERRED_BEHAVIOR_UNRELIABLE:SPACES_CONTROL'],
    });
  });

  it('rejects a disconnect during an initialization behavior check', () => {
    expect(AdapterCompatibilityClassifier.classify(baseEvidence({
      initializationChecks: [preferredCheck({ outcome: 'DISCONNECTED', response: null })],
    }))).toEqual({
      grade: 'UNSUPPORTED',
      reasons: ['DISCONNECTED_DURING_INITIALIZATION_BEHAVIOR:SPACES_CONTROL'],
    });
  });
});
