import { FindingSource } from '../../../domain/evaluation/models/enums';
import { decideCheckClaimAuthority } from '../CheckClaimAuthority';

describe('CheckClaimAuthority', () => {
  it('allows system observations with explicit provenance', () => {
    expect(decideCheckClaimAuthority('OBSERVATION', 'SYSTEM').allowed).toBe(true);
  });

  it('allows deterministic system findings as reviewable SYSTEM_RULE findings', () => {
    const decision = decideCheckClaimAuthority('FINDING', 'SYSTEM');
    expect(decision.allowed).toBe(true);
    expect(decision.findingSource).toBe(FindingSource.SYSTEM_RULE);
  });

  it('forbids the system from authoring a professional conclusion', () => {
    const decision = decideCheckClaimAuthority('PROFESSIONAL_CONCLUSION', 'SYSTEM');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('technician');
  });

  it('allows technician professional conclusions after review', () => {
    expect(decideCheckClaimAuthority('PROFESSIONAL_CONCLUSION', 'TECHNICIAN').allowed).toBe(true);
  });
});
