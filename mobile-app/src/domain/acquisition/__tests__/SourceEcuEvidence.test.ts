import {
  UNKNOWN_ECU_KEY,
  appendPidEvidence,
  canonicalEcuKey,
  ecuKeyToStorageAddress
} from '../SourceEcuEvidence';

describe('SourceEcuEvidence', () => {
  it('canonicalizes 11-bit and 29-bit ECU addresses', () => {
    expect(canonicalEcuKey('7e8')).toBe('7E8');
    expect(canonicalEcuKey('0x18daf110')).toBe('18DAF110');
    expect(ecuKeyToStorageAddress('7E8')).toBe(0x7E8);
    expect(ecuKeyToStorageAddress('18DAF110')).toBe(0x18DAF110);
  });

  it('uses an explicit unknown bucket only when no header exists', () => {
    expect(canonicalEcuKey(null)).toBe(UNKNOWN_ECU_KEY);
    expect(ecuKeyToStorageAddress(UNKNOWN_ECU_KEY)).toBe(0);
  });

  it('keeps conflicting ECU evidence separate and deduplicated', () => {
    const evidence: Record<string, string[]> = {};
    appendPidEvidence(evidence, '7E8', ['010C', '010D']);
    appendPidEvidence(evidence, '7E8', ['010C']);
    appendPidEvidence(evidence, '7E9', ['0105']);

    expect(evidence).toEqual({
      '7E8': ['010C', '010D'],
      '7E9': ['0105']
    });
  });

  it('rejects invalid addresses instead of manufacturing ECU identity', () => {
    expect(() => ecuKeyToStorageAddress('NOT-AN-ECU')).toThrow('INVALID_ECU_ADDRESS');
  });
});
