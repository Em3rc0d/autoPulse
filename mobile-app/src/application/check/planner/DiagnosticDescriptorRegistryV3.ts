import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { DiagnosticRequestDescriptor } from './DiagnosticRequestDescriptor';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V2,
  createDiagnosticDescriptorRegistry,
} from './DiagnosticDescriptorRegistry';

const STANDARD_OBD_PROTOCOLS: readonly DiagnosticProtocol[] = Object.freeze([
  'ISO_15765_CAN',
  'ISO_14230_KWP',
  'ISO_9141_2',
  'SAE_J1850_PWM',
  'SAE_J1850_VPW',
]);

const PROVENANCE =
  'CHECK v5 adaptive Mode 01 evidence; standard OBD read-only service + deterministic promoted decoder + fail-closed parser/safety contract; physical protocol breadth remains a certification claim gate';

function mode01(pid: string): DiagnosticRequestDescriptor {
  return {
    descriptorId: `check-v5-mode01-observe-${pid.toLowerCase()}`,
    semanticId: `check.obd.mode01.observe.${pid}`,
    requestKind: 'OBD_STANDARD',
    service: '01',
    pid,
    expectedResponseService: '41',
    parserContractId: 'check.mode01.direct-observation/v1',
    stage: 'TARGETED_PID_ACQUISITION',
    safetyClassification: 'READ_ONLY_PROVEN',
    supportedProtocols: STANDARD_OBD_PROTOCOLS,
    activationCondition: { kind: 'ALWAYS' },
    provenance: PROVENANCE,
    executionMode: 'SERIAL_ONLY',
  };
}

/**
 * Promoted deterministic Mode 01 evidence not already present in V2.
 * This is an allowlist, not a scan list. The adaptive planner selects at most
 * its bounded command budget and never iterates the full reference wallet.
 */
export const CHECK_V4_TARGETED_MODE01_PIDS = Object.freeze([
  '01','04','06','07','0A','0B','0E','0F','10','11','14','15',
  '1F','21','2F','30','31','33','3C','3D','3E','3F','42','45',
  '46','4D','4E','5C','5D','5E','61','62','63',
] as const);

export const CHECK_CORE_DESCRIPTOR_REGISTRY_V3 = createDiagnosticDescriptorRegistry(
  'check-core-descriptors/v3',
  [
    ...CHECK_CORE_DESCRIPTOR_REGISTRY_V2.descriptors,
    ...CHECK_V4_TARGETED_MODE01_PIDS.map(mode01),
  ],
);
