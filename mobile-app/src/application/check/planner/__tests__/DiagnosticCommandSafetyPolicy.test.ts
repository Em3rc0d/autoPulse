import type { DiagnosticRequestDescriptor } from '../DiagnosticRequestDescriptor';
import { authorizeRegisteredDescriptor, evaluateDescriptorSafety } from '../DiagnosticCommandSafetyPolicy';
import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1, createDiagnosticDescriptorRegistry } from '../DiagnosticDescriptorRegistry';

const forged = (overrides: Partial<DiagnosticRequestDescriptor> = {}): DiagnosticRequestDescriptor => ({
  descriptorId: 'forged', semanticId: 'forged.semantic', requestKind: 'OBD_STANDARD', service: '03', expectedResponseService: '43',
  parserContractId: 'fixture', stage: 'DTC_CORE', safetyClassification: 'READ_ONLY_PROVEN', supportedProtocols: ['ISO_14230_KWP'],
  activationCondition: { kind: 'ALWAYS' }, provenance: 'fixture', executionMode: 'SERIAL_ONLY', ...overrides,
});

describe('CHECK-MK5 DiagnosticCommandSafetyPolicy', () => {
  it('allows only an exact registered READ_ONLY_PROVEN descriptor on a promoted protocol', () => {
    const decision = authorizeRegisteredDescriptor(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode03.stored-dtc', 'ISO_14230_KWP');
    expect(decision.disposition).toBe('ALLOW');
    if (decision.disposition === 'ALLOW') {
      expect(decision.descriptor.service).toBe('03');
      expect(decision.descriptor.safetyClassification).toBe('READ_ONLY_PROVEN');
    }
  });

  it('default-denies an unknown semantic operation', () => {
    expect(authorizeRegisteredDescriptor(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode01.pid.FF', 'ISO_14230_KWP')).toEqual(expect.objectContaining({
      disposition: 'BLOCK', reason: 'UNREGISTERED_DESCRIPTOR',
    }));
  });

  it('blocks a non-allowlisted registry version even when its descriptor looks safe', () => {
    const canonical = CHECK_CORE_DESCRIPTOR_REGISTRY_V1.bySemanticId['check.obd.mode03.stored-dtc'];
    const alternate = createDiagnosticDescriptorRegistry('alternate-registry/v1', [canonical]);
    expect(authorizeRegisteredDescriptor(alternate, canonical.semanticId, 'ISO_14230_KWP')).toEqual(expect.objectContaining({
      disposition: 'BLOCK', reason: 'REGISTRY_NOT_ALLOWLISTED',
    }));
  });

  it('blocks a tampered descriptor definition even if it reuses the canonical registry version', () => {
    const tampered = createDiagnosticDescriptorRegistry(CHECK_CORE_DESCRIPTOR_REGISTRY_V1.version, [
      forged({
        descriptorId: 'check-core-mode03-stored-dtc', semanticId: 'check.obd.mode03.stored-dtc', service: '05', expectedResponseService: '45',
        parserContractId: 'check.dtc-service/v1', provenance: 'Q-CHECK-001 + Q-CHECK-008 + CHECK-MK4 DtcServiceParser',
      }),
    ]);
    expect(authorizeRegisteredDescriptor(tampered, 'check.obd.mode03.stored-dtc', 'ISO_14230_KWP')).toEqual(expect.objectContaining({
      disposition: 'BLOCK', reason: 'DESCRIPTOR_DEFINITION_MISMATCH',
    }));
  });

  it('blocks mutating services even if a forged descriptor lies about classification', () => {
    expect(evaluateDescriptorSafety(forged({ service: '04', expectedResponseService: '44' }), 'ISO_14230_KWP')).toEqual(expect.objectContaining({
      disposition: 'BLOCK', reason: 'MUTATING_SERVICE_BLOCKED',
    }));
    expect(evaluateDescriptorSafety(forged({ service: '08', expectedResponseService: '48' }), 'ISO_14230_KWP')).toEqual(expect.objectContaining({
      disposition: 'BLOCK', reason: 'MUTATING_SERVICE_BLOCKED',
    }));
  });

  it('blocks unproven classifications and non-Core request kinds', () => {
    expect(evaluateDescriptorSafety(forged({ safetyClassification: 'READ_ONLY_EXPECTED' }), 'ISO_14230_KWP')).toEqual(expect.objectContaining({ disposition: 'BLOCK', reason: 'CLASSIFICATION_NOT_PROVEN' }));
    expect(evaluateDescriptorSafety(forged({ requestKind: 'RAW_DIAGNOSTIC' }), 'ISO_14230_KWP')).toEqual(expect.objectContaining({ disposition: 'BLOCK', reason: 'REQUEST_KIND_NOT_ALLOWED' }));
    expect(evaluateDescriptorSafety(forged({ requestKind: 'VENDOR_SPECIFIC' }), 'ISO_14230_KWP')).toEqual(expect.objectContaining({ disposition: 'BLOCK', reason: 'REQUEST_KIND_NOT_ALLOWED' }));
    expect(evaluateDescriptorSafety(forged({ requestKind: 'UDS' }), 'ISO_14230_KWP')).toEqual(expect.objectContaining({ disposition: 'BLOCK', reason: 'REQUEST_KIND_NOT_ALLOWED' }));
  });

  it('default-denies a descriptor on a protocol whose parser/envelope is not promoted', () => {
    expect(authorizeRegisteredDescriptor(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode07.pending-dtc', 'ISO_15765_CAN')).toEqual(expect.objectContaining({
      disposition: 'BLOCK', reason: 'PROTOCOL_NOT_PROMOTED',
    }));
    expect(authorizeRegisteredDescriptor(CHECK_CORE_DESCRIPTOR_REGISTRY_V1, 'check.obd.mode03.stored-dtc', 'ISO_15765_CAN').disposition).toBe('ALLOW');
  });
});
