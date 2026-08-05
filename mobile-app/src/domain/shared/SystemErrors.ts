export type SystemErrorCode = 
  // TRANSPORT
  | 'AP-TRN-001' // CONNECTION_LOST
  | 'AP-TRN-002' // COMMAND_TIMEOUT
  | 'AP-TRN-003' // WRITE_FAILED

  // ELM
  | 'AP-ELM-001' // ADAPTER_ERROR
  | 'AP-ELM-002' // ADAPTER_NOT_READY

  // OBD
  | 'AP-OBD-001' // ECU_NO_DATA
  | 'AP-OBD-002' // NEGATIVE_RESPONSE
  | 'AP-OBD-003' // INVALID_RESPONSE
  | 'AP-OBD-004' // DTC_READ_FAILED

  // CAPABILITIES
  | 'AP-CAP-001' // DISCOVERY_FAILED
  | 'AP-CAP-002' // NO_SUPPORTED_CORE_SIGNALS
  | 'AP-CAP-003' // SNAPSHOT_PERSISTENCE_FAILED
  | 'AP-CAP-004' // INCONSISTENT_DISCOVERY_EVIDENCE

  // LIVE
  | 'AP-LIV-001' // SESSION_ACTIVATION_FAILED
  | 'AP-LIV-002' // SESSION_INTERRUPTED
  | 'AP-LIV-003' // UNEXPECTED_APP_TERMINATION
  | 'AP-LIV-004' // TELEMETRY_PERSISTENCE_FAILED

  // TELEMETRY BLOCKS
  | 'AP-BLK-001' // CORRUPTED_PAYLOAD
  | 'AP-BLK-002' // UNSUPPORTED_FORMAT
  | 'AP-BLK-003' // COMMIT_TIMEOUT
  | 'AP-BLK-004' // SEQUENCE_GAP

  // DATABASE
  | 'AP-DB-001'  // LOCAL_CONTEXT_UNAVAILABLE
  | 'AP-DB-002'  // LOCAL_CONTEXT_CORRUPT
  | 'AP-DB-003'; // DATABASE_WRITE_FAILED

export type SystemIssueSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';

export interface SystemErrorDefinition {
  readonly code: SystemErrorCode;
  readonly canonicalName: string;
  readonly severity: SystemIssueSeverity;
  readonly retryable: boolean;
  readonly messageKey: string;
}

export interface SystemIssue {
  readonly code: SystemErrorCode;
  readonly severity: SystemIssueSeverity;
  readonly retryable: boolean;
  readonly occurredAt: number;
  readonly rawCause?: string;
  readonly context?: Record<string, string | number | boolean | null>;
}

export const SystemErrorCatalog: Record<SystemErrorCode, SystemErrorDefinition> = {
  // TRANSPORT
  'AP-TRN-001': { code: 'AP-TRN-001', canonicalName: 'CONNECTION_LOST', severity: 'ERROR', retryable: true, messageKey: 'error.trn.connection_lost' },
  'AP-TRN-002': { code: 'AP-TRN-002', canonicalName: 'COMMAND_TIMEOUT', severity: 'WARNING', retryable: true, messageKey: 'error.trn.command_timeout' },
  'AP-TRN-003': { code: 'AP-TRN-003', canonicalName: 'WRITE_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.trn.write_failed' },

  // ELM
  'AP-ELM-001': { code: 'AP-ELM-001', canonicalName: 'ADAPTER_ERROR', severity: 'ERROR', retryable: false, messageKey: 'error.elm.adapter_error' },
  'AP-ELM-002': { code: 'AP-ELM-002', canonicalName: 'ADAPTER_NOT_READY', severity: 'WARNING', retryable: true, messageKey: 'error.elm.adapter_not_ready' },

  // OBD
  'AP-OBD-001': { code: 'AP-OBD-001', canonicalName: 'ECU_NO_DATA', severity: 'INFO', retryable: true, messageKey: 'error.obd.ecu_no_data' },
  'AP-OBD-002': { code: 'AP-OBD-002', canonicalName: 'NEGATIVE_RESPONSE', severity: 'WARNING', retryable: false, messageKey: 'error.obd.negative_response' },
  'AP-OBD-003': { code: 'AP-OBD-003', canonicalName: 'INVALID_RESPONSE', severity: 'WARNING', retryable: false, messageKey: 'error.obd.invalid_response' },
  'AP-OBD-004': { code: 'AP-OBD-004', canonicalName: 'DTC_READ_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.obd.dtc_read_failed' },

  // CAPABILITIES
  'AP-CAP-001': { code: 'AP-CAP-001', canonicalName: 'DISCOVERY_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.cap.discovery_failed' },
  'AP-CAP-002': { code: 'AP-CAP-002', canonicalName: 'NO_SUPPORTED_CORE_SIGNALS', severity: 'WARNING', retryable: false, messageKey: 'error.cap.no_supported_core_signals' },
  'AP-CAP-003': { code: 'AP-CAP-003', canonicalName: 'SNAPSHOT_PERSISTENCE_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.cap.snapshot_persistence_failed' },
  'AP-CAP-004': { code: 'AP-CAP-004', canonicalName: 'INCONSISTENT_DISCOVERY_EVIDENCE', severity: 'WARNING', retryable: false, messageKey: 'error.cap.inconsistent_evidence' },

  // LIVE
  'AP-LIV-001': { code: 'AP-LIV-001', canonicalName: 'SESSION_ACTIVATION_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.liv.session_activation_failed' },
  'AP-LIV-002': { code: 'AP-LIV-002', canonicalName: 'SESSION_INTERRUPTED', severity: 'ERROR', retryable: false, messageKey: 'error.liv.session_interrupted' },
  'AP-LIV-003': { code: 'AP-LIV-003', canonicalName: 'UNEXPECTED_APP_TERMINATION', severity: 'FATAL', retryable: false, messageKey: 'error.liv.unexpected_app_termination' },
  'AP-LIV-004': { code: 'AP-LIV-004', canonicalName: 'TELEMETRY_PERSISTENCE_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.liv.telemetry_persistence_failed' },

  // TELEMETRY BLOCKS
  'AP-BLK-001': { code: 'AP-BLK-001', canonicalName: 'CORRUPTED_PAYLOAD', severity: 'ERROR', retryable: false, messageKey: 'error.blk.corrupted_payload' },
  'AP-BLK-002': { code: 'AP-BLK-002', canonicalName: 'UNSUPPORTED_FORMAT', severity: 'FATAL', retryable: false, messageKey: 'error.blk.unsupported_format' },
  'AP-BLK-003': { code: 'AP-BLK-003', canonicalName: 'COMMIT_TIMEOUT', severity: 'WARNING', retryable: true, messageKey: 'error.blk.commit_timeout' },
  'AP-BLK-004': { code: 'AP-BLK-004', canonicalName: 'SEQUENCE_GAP', severity: 'WARNING', retryable: false, messageKey: 'error.blk.sequence_gap' },

  // DATABASE
  'AP-DB-001': { code: 'AP-DB-001', canonicalName: 'LOCAL_CONTEXT_UNAVAILABLE', severity: 'FATAL', retryable: true, messageKey: 'error.db.local_context_unavailable' },
  'AP-DB-002': { code: 'AP-DB-002', canonicalName: 'LOCAL_CONTEXT_CORRUPT', severity: 'FATAL', retryable: false, messageKey: 'error.db.local_context_corrupt' },
  'AP-DB-003': { code: 'AP-DB-003', canonicalName: 'DATABASE_WRITE_FAILED', severity: 'ERROR', retryable: true, messageKey: 'error.db.write_failed' }
};
