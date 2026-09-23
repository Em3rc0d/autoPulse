export type DiagnosticEvidenceSourceType =
  | 'DTC'
  | 'CURRENT_PID'
  | 'FREEZE_FRAME'
  | 'READINESS'
  | 'MODE06'
  | 'LIVE_HISTORY'
  | 'COMPATIBILITY';

export type DiagnosticEvidenceQuality = 'CONFIRMED_BY_ECU' | 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';
export type DiagnosticEvidenceRelationType = 'SUPPORTS' | 'CONTRADICTS' | 'CONTEXTUALIZES' | 'CO_OCCURS' | 'UNAVAILABLE';
export type DiagnosticEvidenceScalar = string | number | boolean | null;
export type DiagnosticEvidenceValue = DiagnosticEvidenceScalar | readonly DiagnosticEvidenceScalar[] | Readonly<Record<string, DiagnosticEvidenceScalar>>;

export interface DiagnosticEvidenceFact {
  readonly evidenceId: string;
  readonly sourceType: DiagnosticEvidenceSourceType;
  readonly sourceEndpointId: string | null;
  readonly observedAt: number;
  readonly value: DiagnosticEvidenceValue;
  readonly unit?: string;
  readonly quality: DiagnosticEvidenceQuality;
  readonly provenance: string;
}

export interface DiagnosticEvidenceRelation {
  readonly relationId: string;
  readonly fromEvidenceId: string;
  readonly toEvidenceId: string;
  readonly relation: DiagnosticEvidenceRelationType;
  readonly ruleId?: string;
  readonly ruleVersion?: string;
}
