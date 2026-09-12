import type { DiagnosticRequestDescriptor } from '../DiagnosticRequestDescriptor';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  createDiagnosticDescriptorRegistry,
  resolveDescriptorByAddress,
  resolveDescriptorBySemanticId,
} from '../DiagnosticDescriptorRegistry';

const baseDescriptor = (overrides: Partial<DiagnosticRequestDescriptor> = {}): DiagnosticRequestDescriptor => ({
  descriptorId: 'fixture-03',
  semanticId: 'fixture.mode03',
  requestKind: 'OBD_STANDARD',
  service: '03',
  expectedResponseService: '43',
  parserContractId: 'fixture-parser',
  stage: 'DTC_CORE',
  safetyClassification: 'READ_ONLY_PROVEN',
  supportedProtocols: ['ISO_14230_KWP'],
  activationCondition: { kind: 'ALWAYS' },
  provenance: 'fixture',
  executionMode: 'SERIAL_ONLY',
  ...overrides,
});

describe('CHECK-MK5 DiagnosticDescriptorRegistry', () => {
  it('contains only explicitly promoted Core descriptors', () => {
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode03.stored-dtc')?.service).toBe('03');
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode07.pending-dtc')?.service).toBe('07');
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode0a.permanent-dtc')?.service).toBe('0A');
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode01.support.00')?.pid).toBe('00');

    // Readiness PID 01 is intentionally not promoted by MK4 yet.
    expect(resolveDescriptorByAddress(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'OBD_STANDARD', '01', '01')).toBeUndefined();
    expect(resolveDescriptorByAddress(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'OBD_STANDARD', '01', 'FF')).toBeUndefined();
  });

  it('captures parser-envelope protocol promotion per exact descriptor', () => {
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode03.stored-dtc')?.supportedProtocols).toContain('ISO_15765_CAN');
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode07.pending-dtc')?.supportedProtocols).not.toContain('ISO_15765_CAN');
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode0a.permanent-dtc')?.supportedProtocols).not.toContain('ISO_15765_CAN');
  });

  it('requires endpoint advertisement before later Mode 01 support blocks', () => {
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode01.support.00')?.activationCondition).toEqual({ kind: 'ALWAYS' });
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode01.support.20')?.activationCondition).toEqual({
      kind: 'REQUIRES_ENDPOINT_ADVERTISEMENT',
      advertisedPid: '0120',
    });
    expect(resolveDescriptorBySemanticId(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode01.support.C0')?.activationCondition).toEqual({
      kind: 'REQUIRES_ENDPOINT_ADVERTISEMENT',
      advertisedPid: '01C0',
    });
  });

  it('rejects mutating, non-Core and unproven descriptors at registry construction', () => {
    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ service: '04', expectedResponseService: '44' }),
    ])).toThrow('mutating service 04');

    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ requestKind: 'RAW_DIAGNOSTIC' }),
    ])).toThrow('not allowlisted for Check Core');

    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ safetyClassification: 'READ_ONLY_EXPECTED' }),
    ])).toThrow('not READ_ONLY_PROVEN');
  });

  it('rejects empty, unknown/UDS or duplicated protocol promotion', () => {
    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ supportedProtocols: [] }),
    ])).toThrow('at least one promoted protocol');
    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ supportedProtocols: ['UNKNOWN'] }),
    ])).toThrow('non-Core/unproven protocol');
    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ supportedProtocols: ['ISO_14230_KWP', 'ISO_14230_KWP'] }),
    ])).toThrow('duplicate protocols');
  });

  it('rejects invalid chained-advertisement identities', () => {
    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ activationCondition: { kind: 'REQUIRES_ENDPOINT_ADVERTISEMENT', advertisedPid: '120' } }),
    ])).toThrow('invalid advertised-PID precondition');
  });

  it('rejects duplicate semantic, descriptor and exact address identities', () => {
    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor(),
      baseDescriptor({ descriptorId: 'fixture-03-2' }),
    ])).toThrow('Duplicate diagnostic semanticId');

    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor(),
      baseDescriptor({ semanticId: 'fixture.mode03.second' }),
    ])).toThrow('Duplicate diagnostic descriptorId');

    expect(() => createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor(),
      baseDescriptor({ descriptorId: 'fixture-03-2', semanticId: 'fixture.mode03.second' }),
    ])).toThrow('Duplicate diagnostic descriptor address');
  });

  it('normalizes exact byte identities without prefix or prototype-chain matching', () => {
    const registry = createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ service: '0a', expectedResponseService: '4a', semanticId: '__proto__' }),
    ]);
    expect(resolveDescriptorByAddress(registry, 'OBD_STANDARD', '0A')?.semanticId).toBe('__proto__');
    expect(resolveDescriptorBySemanticId(registry, '__proto__')?.service).toBe('0A');
    expect(resolveDescriptorByAddress(registry, 'OBD_STANDARD', '0')).toBeUndefined();
    expect(resolveDescriptorByAddress(registry, 'OBD_STANDARD', '0A', '00')).toBeUndefined();
  });
});
