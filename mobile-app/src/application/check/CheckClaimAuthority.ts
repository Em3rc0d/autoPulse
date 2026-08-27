import { FindingSource } from '../../domain/evaluation/models/enums';

export type CheckClaimKind = 'OBSERVATION' | 'FINDING' | 'PROFESSIONAL_CONCLUSION';
export type CheckClaimAuthor = 'SYSTEM' | 'TECHNICIAN';

export interface CheckClaimAuthorityDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly findingSource?: FindingSource;
}

export function decideCheckClaimAuthority(
  kind: CheckClaimKind,
  author: CheckClaimAuthor,
): CheckClaimAuthorityDecision {
  if (kind === 'OBSERVATION') {
    return {
      allowed: true,
      reason: 'Observations may be recorded by the system or technician when provenance is explicit.',
    };
  }

  if (kind === 'FINDING') {
    return author === 'SYSTEM'
      ? {
          allowed: true,
          reason: 'The system may propose a deterministic finding, but it remains reviewable and must cite evidence.',
          findingSource: FindingSource.SYSTEM_RULE,
        }
      : {
          allowed: true,
          reason: 'A technician may create or modify a finding and is accountable for its evidence basis.',
          findingSource: FindingSource.TECHNICIAN,
        };
  }

  if (author === 'SYSTEM') {
    return {
      allowed: false,
      reason: 'AutoPulse must not independently author a professional conclusion. Professional conclusions require technician review.',
    };
  }

  return {
    allowed: true,
    reason: 'Professional conclusion is technician-authored after evidence and finding review.',
  };
}
