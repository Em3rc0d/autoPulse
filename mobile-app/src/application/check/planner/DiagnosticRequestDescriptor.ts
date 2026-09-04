import type { DiagnosticSafetyClassification } from '../../../domain/check/DiagnosticSafetyClassification';
import type { DiagnosticRequestKind } from '../../../domain/diagnostics/DiagnosticConnector';

export type DiagnosticPlannerStage = 'CAPABILITY_DISCOVERY' | 'DTC_CORE';

/**
 * Declarative identity for one exact diagnostic operation.
 *
 * Deliberately contains no transport payload or connector callback. MK5 plans
 * semantic operations only; wire encoding/execution belongs to later gates.
 */
export interface DiagnosticRequestDescriptor {
  readonly descriptorId: string;
  readonly semanticId: string;
  readonly requestKind: DiagnosticRequestKind;
  readonly service: string;
  readonly pid?: string;
  readonly subfunction?: string;
  readonly expectedResponseService: string;
  readonly parserContractId: string;
  readonly stage: DiagnosticPlannerStage;
  readonly safetyClassification: DiagnosticSafetyClassification;
  readonly provenance: string;
  readonly executionMode: 'SERIAL_ONLY';
}

export function normalizeDiagnosticByteHex(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[0-9A-F]{2}$/.test(normalized) ? normalized : null;
}

export function descriptorAddressKey(descriptor: Pick<
  DiagnosticRequestDescriptor,
  'requestKind' | 'service' | 'pid' | 'subfunction'
>): string {
  return [
    descriptor.requestKind,
    descriptor.service.toUpperCase(),
    descriptor.pid?.toUpperCase() ?? '-',
    descriptor.subfunction?.toUpperCase() ?? '-',
  ].join(':');
}
