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

  it('normalizes exact byte identities without prefix matching', () => {
    const registry = createDiagnosticDescriptorRegistry('fixture', [
      baseDescriptor({ service: '0a', expectedResponseService: '4a', semanticId: 'fixture.mode0a' }),
    ]);
    expect(resolveDescriptorByAddress(registry, 'OBD_STANDARD', '0A')?.semanticId).toBe('fixture.mode0a');
    expect(resolveDescriptorByAddress(registry, 'OBD_STANDARD', '0')).toBeUndefined();
    expect(resolveDescriptorByAddress(registry, 'OBD_STANDARD', '0A', '00')).toBeUndefined();
  });
});
