import { DomainError } from '../../shared/domainError';

export const BridgeErrorCodes = {
  AUTOMATIC_PROMOTION_FORBIDDEN: 'BRG-001',
  EVALUATION_NOT_ACCEPTING_EVIDENCE: 'BRG-002',
  WINDOW_NOT_FROZEN: 'BRG-003',
  EVIDENCE_ALREADY_PROMOTED: 'BRG-004'
} as const;

export function createBridgeError(code: string, message: string, context?: Record<string, any>): DomainError {
  return { code, message, context };
}
