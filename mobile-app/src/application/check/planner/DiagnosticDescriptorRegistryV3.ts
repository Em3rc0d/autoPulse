import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticRequestDescriptor } from './DiagnosticRequestDescriptor';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V2,
  createDiagnosticDescriptorRegistry,
} from './DiagnosticDescriptorRegistry';

const KWP_ONLY: readonly DiagnosticProtocol[] = Object.freeze(['ISO_14230_KWP']);
const PROVENANCE = 'CHECK v4 targeted Mode 01 evidence; Q-CHECK safety contract + PID wallet + Logan/Duster physical evidence; READ_ONLY only';

function mode01(pid: string): DiagnosticRequestDescriptor {
  return {
    descriptorId: `check-v4-mode01-observe-${pid.toLowerCase()}`,
    semanticId: `check.obd.mode01.observe.${pid}`,
    requestKind: 'OBD_STANDARD',
    service: '01',
    pid,
    expectedResponseService: '41',
    parserContractId: 'check.mode01.direct-observation/v1',
    stage: 'TARGETED_PID_ACQUISITION',
    safetyClassification: 'READ_ONLY_PROVEN',
    supportedProtocols: KWP_ONLY,
    activationCondition: { kind: 'ALWAYS' },
    provenance: PROVENANCE,
    executionMode: 'SERIAL_ONLY',
  };
}

export const CHECK_V4_TARGETED_MODE01_PIDS = Object.freeze([
  '01','04','06','07','0B','0E','0F','11','14','15',
] as const);

/**
 * Canonical CHECK v3 descriptor registry.
 *
 * This lives inside planner/safety rather than intelligence so the safety
 * authority does not depend upward on an intelligence module. It is an
 * immutable allowlist, never a scan list: planner selection remains bounded
 * and concern-driven.
 */
export const CHECK_CORE_DESCRIPTOR_REGISTRY_V3 = createDiagnosticDescriptorRegistry(
  'check-core-descriptors/v3',
  [
    ...CHECK_CORE_DESCRIPTOR_REGISTRY_V2.descriptors,
    ...CHECK_V4_TARGETED_MODE01_PIDS.map(mode01),
  ],
);
