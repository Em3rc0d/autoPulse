import { SystemErrorCode, SystemErrorCatalog, SystemIssue } from '../../domain/shared/SystemErrors';

export class SystemIssueMapper {
  
  static fromCommandResult(status: string, rawText?: string): SystemIssue | null {
    let code: SystemErrorCode | null = null;

    switch (status) {
      case 'TIMEOUT':
        code = 'AP-TRN-002';
        break;
      case 'DISCONNECTED':
        code = 'AP-TRN-001';
        break;
      case 'WRITE_FAILED':
        code = 'AP-TRN-003';
        break;
      case 'ELM_ERROR':
        code = 'AP-ELM-001';
        break;
      case 'NO_DATA':
        code = 'AP-OBD-001';
        break;
      case 'NEGATIVE_RESPONSE':
        code = 'AP-OBD-002';
        break;
      case 'INVALID_RESPONSE':
        code = 'AP-OBD-003';
        break;
      default:
        return null;
    }

    if (!code) return null;

    const definition = SystemErrorCatalog[code];

    return {
      code: definition.code,
      severity: definition.severity,
      retryable: definition.retryable,
      occurredAt: Date.now(),
      rawCause: rawText,
      context: { originalStatus: status }
    };
  }

  static fromSessionFailure(failureCode: string): SystemIssue {
    let code: SystemErrorCode = 'AP-LIV-002'; // Default fallback

    if (failureCode === 'DISCONNECTED' || failureCode === 'CONNECTION_LOST') {
       code = 'AP-TRN-001';
    } else if (failureCode === 'CORRUPTED') {
       code = 'AP-BLK-001';
    } else if (failureCode === 'TIMEOUT') {
       code = 'AP-TRN-002';
    } else if (failureCode === 'UNSUPPORTED_FORMAT') {
       code = 'AP-BLK-002';
    }

    const definition = SystemErrorCatalog[code];

    return {
      code: definition.code,
      severity: definition.severity,
      retryable: definition.retryable,
      occurredAt: Date.now(),
      context: { failureCode }
    };
  }
}
