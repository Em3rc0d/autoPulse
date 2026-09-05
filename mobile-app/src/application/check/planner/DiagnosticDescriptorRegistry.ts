import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import {
  descriptorAddressKey,
  DiagnosticDescriptorActivationCondition,
  DiagnosticRequestDescriptor,
  normalizeDiagnosticByteHex,
  normalizeDiagnosticCommandHex,
} from './DiagnosticRequestDescriptor';

export const CHECK_MUTATING_OBD_SERVICES = Object.freeze(['04', '08'] as const);

export interface DiagnosticDescriptorRegistry {
  readonly version: string;
  readonly descriptors: readonly DiagnosticRequestDescriptor[];
  readonly bySemanticId: Readonly<Record<string, DiagnosticRequestDescriptor>>;
  readonly byDescriptorId: Readonly<Record<string, DiagnosticRequestDescriptor>>;
  readonly byAddress: Readonly<Record<string, DiagnosticRequestDescriptor>>;
}

const CORE_STANDARD_PROTOCOLS: readonly DiagnosticProtocol[] = Object.freeze([
  'ISO_15765_CAN',
  'ISO_14230_KWP',
  'ISO_9141_2',
  'SAE_J1850_PWM',
  'SAE_J1850_VPW',
]);

const LEGACY_DTC_PROTOCOLS: readonly DiagnosticProtocol[] = Object.freeze([
  'ISO_14230_KWP',
  'ISO_9141_2',
  'SAE_J1850_PWM',
  'SAE_J1850_VPW',
]);

function normalizedActivationCondition(
  descriptor: DiagnosticRequestDescriptor,
): DiagnosticDescriptorActivationCondition {
  if (descriptor.activationCondition.kind === 'ALWAYS') return Object.freeze({ kind: 'ALWAYS' as const });
  const advertisedPid = normalizeDiagnosticCommandHex(descriptor.activationCondition.advertisedPid);
  if (!advertisedPid) {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} has an invalid advertised-PID precondition`);
  }
  return Object.freeze({
    kind: 'REQUIRES_ENDPOINT_ADVERTISEMENT' as const,
    advertisedPid,
  });
}

function normalizedDescriptor(descriptor: DiagnosticRequestDescriptor): DiagnosticRequestDescriptor {
  const service = normalizeDiagnosticByteHex(descriptor.service);
  const expectedResponseService = normalizeDiagnosticByteHex(descriptor.expectedResponseService);
  const pid = descriptor.pid === undefined ? undefined : normalizeDiagnosticByteHex(descriptor.pid);
  const subfunction = descriptor.subfunction === undefined ? undefined : normalizeDiagnosticByteHex(descriptor.subfunction);

  if (!descriptor.descriptorId.trim() || !descriptor.semanticId.trim() || !descriptor.parserContractId.trim() || !descriptor.provenance.trim()) {
    throw new Error('Diagnostic descriptor identifiers/provenance must be non-empty');
  }
  if (!service || !expectedResponseService || (descriptor.pid !== undefined && !pid) || (descriptor.subfunction !== undefined && !subfunction)) {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} contains invalid service/PID/subfunction bytes`);
  }
  if (descriptor.requestKind !== 'OBD_STANDARD') {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} request kind ${descriptor.requestKind} is not allowlisted for Check Core`);
  }
  if (descriptor.safetyClassification !== 'READ_ONLY_PROVEN') {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} is not READ_ONLY_PROVEN`);
  }
  if ((CHECK_MUTATING_OBD_SERVICES as readonly string[]).includes(service)) {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} targets structurally blocked mutating service ${service}`);
  }
  if (descriptor.supportedProtocols.length === 0) {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} must declare at least one promoted protocol`);
  }
  if (descriptor.supportedProtocols.includes('UNKNOWN') || descriptor.supportedProtocols.includes('UDS')) {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} declares a non-Core/unproven protocol`);
  }
  if (new Set(descriptor.supportedProtocols).size !== descriptor.supportedProtocols.length) {
    throw new Error(`Diagnostic descriptor ${descriptor.semanticId} contains duplicate protocols`);
  }

  return Object.freeze({
    ...descriptor,
    service,
    expectedResponseService,
    pid,
    subfunction,
    supportedProtocols: Object.freeze([...descriptor.supportedProtocols]),
    activationCondition: normalizedActivationCondition(descriptor),
    executionMode: 'SERIAL_ONLY' as const,
  });
}

export function createDiagnosticDescriptorRegistry(
  version: string,
  descriptors: readonly DiagnosticRequestDescriptor[],
): DiagnosticDescriptorRegistry {
  if (!version.trim()) throw new Error('Diagnostic descriptor registry version must be non-empty');

  const bySemanticId = Object.create(null) as Record<string, DiagnosticRequestDescriptor>;
  const byDescriptorId = Object.create(null) as Record<string, DiagnosticRequestDescriptor>;
  const byAddress = Object.create(null) as Record<string, DiagnosticRequestDescriptor>;
  const normalized = descriptors.map(normalizedDescriptor);

  for (const descriptor of normalized) {
    const address = descriptorAddressKey(descriptor);
    if (Object.prototype.hasOwnProperty.call(bySemanticId, descriptor.semanticId)) throw new Error(`Duplicate diagnostic semanticId: ${descriptor.semanticId}`);
    if (Object.prototype.hasOwnProperty.call(byDescriptorId, descriptor.descriptorId)) throw new Error(`Duplicate diagnostic descriptorId: ${descriptor.descriptorId}`);
    if (Object.prototype.hasOwnProperty.call(byAddress, address)) throw new Error(`Duplicate diagnostic descriptor address: ${address}`);
    bySemanticId[descriptor.semanticId] = descriptor;
    byDescriptorId[descriptor.descriptorId] = descriptor;
    byAddress[address] = descriptor;
  }

  return Object.freeze({
    version,
    descriptors: Object.freeze([...normalized]),
    bySemanticId: Object.freeze(bySemanticId),
    byDescriptorId: Object.freeze(byDescriptorId),
    byAddress: Object.freeze(byAddress),
  });
}

export function resolveDescriptorBySemanticId(
  registry: DiagnosticDescriptorRegistry,
  semanticId: string,
): DiagnosticRequestDescriptor | undefined {
  return Object.prototype.hasOwnProperty.call(registry.bySemanticId, semanticId)
    ? registry.bySemanticId[semanticId]
    : undefined;
}

export function resolveDescriptorByAddress(
  registry: DiagnosticDescriptorRegistry,
  requestKind: DiagnosticRequestDescriptor['requestKind'],
  service: string,
  pid?: string,
  subfunction?: string,
): DiagnosticRequestDescriptor | undefined {
  const normalizedService = normalizeDiagnosticByteHex(service);
  const normalizedPid = pid === undefined ? undefined : normalizeDiagnosticByteHex(pid);
  const normalizedSubfunction = subfunction === undefined ? undefined : normalizeDiagnosticByteHex(subfunction);
  if (!normalizedService || (pid !== undefined && !normalizedPid) || (subfunction !== undefined && !normalizedSubfunction)) return undefined;

  const key = [
    requestKind,
    normalizedService,
    normalizedPid ?? '-',
    normalizedSubfunction ?? '-',
  ].join(':');
  return Object.prototype.hasOwnProperty.call(registry.byAddress, key)
    ? registry.byAddress[key]
    : undefined;
}

const descriptor = (
  descriptorId: string,
  semanticId: string,
  service: string,
  expectedResponseService: string,
  parserContractId: string,
  stage: DiagnosticRequestDescriptor['stage'],
  provenance: string,
  supportedProtocols: readonly DiagnosticProtocol[],
  pid?: string,
  activationCondition: DiagnosticDescriptorActivationCondition = { kind: 'ALWAYS' },
): DiagnosticRequestDescriptor => ({
  descriptorId,
  semanticId,
  requestKind: 'OBD_STANDARD',
  service,
  pid,
  expectedResponseService,
  parserContractId,
  stage,
  safetyClassification: 'READ_ONLY_PROVEN',
  supportedProtocols,
  activationCondition,
  provenance,
  executionMode: 'SERIAL_ONLY',
});

const MODE01_BITMAP_PIDS = ['00', '20', '40', '60', '80', 'A0', 'C0'] as const;

export const CHECK_CORE_DESCRIPTOR_REGISTRY_V1 = createDiagnosticDescriptorRegistry(
  'check-core-descriptors/v1',
  [
    ...MODE01_BITMAP_PIDS.map((pid, index) => descriptor(
      `check-core-mode01-support-${pid.toLowerCase()}`,
      `check.obd.mode01.support.${pid}`,
      '01',
      '41',
      'check.mode01.support-bitmap/v1',
      'CAPABILITY_DISCOVERY',
      'Q-CHECK-002 + CHECK-MK4 PidSupportBitmapParser',
      CORE_STANDARD_PROTOCOLS,
      pid,
      index === 0
        ? { kind: 'ALWAYS' }
        : { kind: 'REQUIRES_ENDPOINT_ADVERTISEMENT', advertisedPid: `01${pid}` },
    )),
    descriptor(
      'check-core-mode03-stored-dtc',
      'check.obd.mode03.stored-dtc',
      '03',
      '43',
      'check.dtc-service/v1',
      'DTC_CORE',
      'Q-CHECK-001 + Q-CHECK-008 + CHECK-MK4 DtcServiceParser',
      CORE_STANDARD_PROTOCOLS,
    ),
    descriptor(
      'check-core-mode07-pending-dtc',
      'check.obd.mode07.pending-dtc',
      '07',
      '47',
      'check.dtc-service/v1',
      'DTC_CORE',
      'Q-CHECK-001 + Q-CHECK-008 + CHECK-MK4 DtcServiceParser; CAN envelope not yet fixture-promoted',
      LEGACY_DTC_PROTOCOLS,
    ),
    descriptor(
      'check-core-mode0a-permanent-dtc',
      'check.obd.mode0a.permanent-dtc',
      '0A',
      '4A',
      'check.dtc-service/v1',
      'DTC_CORE',
      'Q-CHECK-001 + Q-CHECK-008 + CHECK-MK4 DtcServiceParser; CAN envelope not yet fixture-promoted',
      LEGACY_DTC_PROTOCOLS,
    ),
  ],
);
