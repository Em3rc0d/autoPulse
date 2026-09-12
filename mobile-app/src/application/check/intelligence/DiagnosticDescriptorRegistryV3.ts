import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticRequestDescriptor } from '../planner/DiagnosticRequestDescriptor';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V2,
  createDiagnosticDescriptorRegistry,
} from '../planner/DiagnosticDescriptorRegistry';

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

const ADDED_PIDS = ['01','04','06','07','0B','0E','0F','11','14','15'] as const;

/**
 * V3 extends the physically exercised V2 registry with only deterministic,
 * read-only KWP Mode 01 evidence descriptors. Selection still belongs to the
 * concern-driven planner; this registry is an allowlist, not a scan list.
 */
export const CHECK_CORE_DESCRIPTOR_REGISTRY_V3 = createDiagnosticDescriptorRegistry(
  'check-core-descriptors/v3',
  [
    ...CHECK_CORE_DESCRIPTOR_REGISTRY_V2.descriptors,
    ...ADDED_PIDS.map(mode01),
  ],
);
