import { SystemErrorCode, SystemErrorCatalog, SystemIssue, SystemIssueSeverity } from '../../domain/shared/SystemErrors';

export class SystemIssueMapper {
  
  static fromCommandResult(status: string, rawText?: string): SystemIssue | null {
    let code: SystemErrorCode | null = null;
    let severity: SystemIssueSeverity = 'WARNING';
    let retryable = false;

    switch (status) {
      case 'TIMEOUT':
        code = 'AP-TRN-002';
        severity = 'WARNING';
        retryable = true;
        break;
      case 'DISCONNECTED':
        code = 'AP-TRN-001';
        severity = 'ERROR';
        retryable = true;
        break;
      case 'WRITE_FAILED':
        code = 'AP-TRN-003';
        severity = 'ERROR';
        retryable = true;
        break;
      case 'ELM_ERROR':
        code = 'AP-ELM-001';
        severity = 'ERROR';
        retryable = false;
        break;
      case 'NO_DATA':
        code = 'AP-OBD-001';
        severity = 'INFO';
        retryable = true;
        break;
      case 'NEGATIVE_RESPONSE':
        code = 'AP-OBD-002';
        severity = 'WARNING';
        retryable = false;
        break;
      case 'INVALID_RESPONSE':
        code = 'AP-OBD-003';
        severity = 'WARNING';
        retryable = false;
        break;
      default:
        return null;
    }

    if (!code) return null;

    return {
      code,
      severity,
      retryable,
      occurredAt: Date.now(),
      rawCause: rawText,
      context: { originalStatus: status }
    };
  }

  static fromSessionFailure(failureCode: string): SystemIssue {
    let code: SystemErrorCode = 'AP-LIV-002'; // Default fallback
    let severity: SystemIssueSeverity = 'ERROR';
    let retryable = false;

    if (failureCode === 'DISCONNECTED') {
       code = 'AP-TRN-001';
       retryable = true;
    } else if (failureCode === 'CONNECTION_LOST') {
       code = 'AP-TRN-001';
       retryable = true;
    } else if (failureCode === 'CORRUPTED') {
       code = 'AP-BLK-001';
    } else if (failureCode === 'TIMEOUT') {
       code = 'AP-TRN-002';
       retryable = true;
       severity = 'WARNING';
    } else if (failureCode === 'UNSUPPORTED_FORMAT') {
       code = 'AP-BLK-002';
       severity = 'FATAL';
    }

    return {
      code,
      severity,
      retryable,
      occurredAt: Date.now(),
      context: { failureCode }
    };
  }
}
