import { DomainError } from '../../shared/domainError';

export const TelemetryErrorCodes = {
  INVALID_SESSION_TRANSITION: 'TEL-001',
  UNSUPPORTED_SIGNAL: 'TEL-002',
  SIGNAL_UNAVAILABLE: 'TEL-003',
  WINDOW_UNAVAILABLE: 'TEL-004',
  INVALID_WINDOW: 'TEL-005',
  SESSION_NOT_RECORDING: 'TEL-006',
  INVALID_VALUE: 'TEL-007'
} as const;

export function createTelemetryError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}
