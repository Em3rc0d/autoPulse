import { TechnicianId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';

export type AuditAction = 
  | 'EVALUATION_OPENED'
  | 'EVALUATION_STATE_CHANGED'
  | 'FINDING_CONFIRMED'
  | 'EVALUATION_SIGNED'
  | 'EVALUATION_VOIDED'
  | 'TELEMETRY_PROMOTED'
  | 'REPORT_DELIVERED';

export interface AuditEvent {
  readonly id: string;
  readonly entityId: string;
  readonly entityType: 'Evaluation' | 'Finding' | 'EvidenceItem' | 'ReportVersion';
  readonly action: AuditAction;
  readonly actor: TechnicianId;
  readonly timestamp: UtcIsoTimestamp;
  readonly previousState?: string;
  readonly nextState?: string;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Record<string, any>;
}
