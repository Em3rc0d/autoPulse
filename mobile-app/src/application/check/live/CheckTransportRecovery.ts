export const CHECK_TRANSPORT_RECOVERY_VERSION = 'check-transport-recovery/v1' as const;

const RECOVERABLE_PREFIXES = Object.freeze([
  'CHECK_ADAPTER_SETUP_FAILED:',
  'CHECK_STANDARD_OBD_UNREACHABLE:',
  'CHECK_PROTOCOL_UNRESOLVED:',
] as const);

export function checkErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function isRecoverableCheckTransportFailure(reason: unknown): boolean {
  const message = checkErrorMessage(reason);
  return RECOVERABLE_PREFIXES.some(prefix => message.startsWith(prefix));
}
