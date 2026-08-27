import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { operators, vehicles, workspaces } from './core';
import { liveSessions } from './live';

export const checkEvaluations = sqliteTable('check_evaluations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'restrict' }),
  operatorId: text('operator_id').notNull().references(() => operators.id, { onDelete: 'restrict' }),
  state: text('state').notNull(),
  purpose: text('purpose').notNull(),
  capabilitiesJson: text('capabilities_json').notNull(),
  scopeJson: text('scope_json').notNull(),
  limitations: text('limitations'),
  symptoms: text('symptoms'),
  createdAt: integer('created_at').notNull(),
  openedAt: integer('opened_at'),
  signedAt: integer('signed_at'),
  cancelledAt: integer('cancelled_at'),
  updatedAt: integer('updated_at').notNull(),
}, table => ({
  workspaceIdx: index('idx_check_evaluations_workspace').on(table.workspaceId),
  vehicleIdx: index('idx_check_evaluations_vehicle').on(table.vehicleId),
  stateIdx: index('idx_check_evaluations_state').on(table.state),
  createdIdx: index('idx_check_evaluations_created').on(table.createdAt),
}));

export const checkEvidenceItems = sqliteTable('check_evidence_items', {
  id: text('id').primaryKey(),
  evaluationId: text('evaluation_id').notNull().references(() => checkEvaluations.id, { onDelete: 'cascade' }),
  liveSessionId: text('live_session_id').references(() => liveSessions.id, { onDelete: 'restrict' }),
  origin: text('origin').notNull(),
  type: text('type').notNull(),
  state: text('state').notNull(),
  capturedAt: integer('captured_at').notNull(),
  contentHash: text('content_hash'),
  localReference: text('local_reference'),
  metadataJson: text('metadata_json'),
  timeWindowStartMs: integer('time_window_start_ms'),
  timeWindowEndMs: integer('time_window_end_ms'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, table => ({
  evaluationIdx: index('idx_check_evidence_evaluation').on(table.evaluationId),
  liveSessionIdx: index('idx_check_evidence_live_session').on(table.liveSessionId),
  originIdx: index('idx_check_evidence_origin').on(table.origin),
}));

export const checkFindings = sqliteTable('check_findings', {
  id: text('id').primaryKey(),
  evaluationId: text('evaluation_id').notNull().references(() => checkEvaluations.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  status: text('status').notNull(),
  severity: text('severity').notNull(),
  confidence: text('confidence').notNull(),
  evidenceIdsJson: text('evidence_ids_json').notNull(),
  systemProposalJson: text('system_proposal_json'),
  professionalReviewJson: text('professional_review_json'),
  technicalExplanation: text('technical_explanation'),
  clientExplanation: text('client_explanation'),
  suggestedAction: text('suggested_action'),
  limitations: text('limitations'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => ({
  evaluationIdx: index('idx_check_findings_evaluation').on(table.evaluationId),
  statusIdx: index('idx_check_findings_status').on(table.status),
  sourceIdx: index('idx_check_findings_source').on(table.source),
}));
