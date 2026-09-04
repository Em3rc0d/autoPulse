import type { DiagnosticRequestDescriptor } from '../DiagnosticRequestDescriptor';
import { authorizeRegisteredDescriptor, evaluateDescriptorSafety } from '../DiagnosticCommandSafetyPolicy';
import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../DiagnosticDescriptorRegistry';

const forged = (overrides: Partial<DiagnosticRequestDescriptor> = {}): DiagnosticRequestDescriptor => ({
  descriptorId: 'forged',
  semanticId: 'forged.semantic',
  requestKind: 'OBD_STANDARD',
  service: '03',
  expectedResponseService: '43',
  parserContractId: 'fixture',
  stage: 'DTC_CORE',
  safetyClassification: 'READ_ONLY_PROVEN',
  provenance: 'fixture',
  executionMode: 'SERIAL_ONLY',
  ...overrides,
});

describe('CHECK-MK5 DiagnosticCommandSafetyPolicy', () => {
  it('allows only an exact registered READ_ONLY_PROVEN descriptor', () => {
    const decision = authorizeRegisteredDescriptor(
      CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
      'check.obd.mode03.stored-dtc',
    );
    expect(decision.disposition).toBe('ALLOW');
    if (decision.disposition === 'ALLOW') {
      expect(decision.descriptor.service).toBe('03');
      expect(decision.descriptor.safetyClassification).toBe('READ_ONLY_PROVEN');
    }
  });

  it('default-denies an unknown semantic operation', () => {
    expect(authorizeRegisteredDescriptor(
      CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
      'check.obd.mode01.pid.FF',
    )).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'UNREGISTERED_DESCRIPTOR',
    }));
  });

  it('blocks mutating services even if a forged descriptor lies about classification', () => {
    expect(evaluateDescriptorSafety(forged({ service: '04', expectedResponseService: '44' }))).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'MUTATING_SERVICE_BLOCKED',
    }));
    expect(evaluateDescriptorSafety(forged({ service: '08', expectedResponseService: '48' }))).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'MUTATING_SERVICE_BLOCKED',
    }));
  });

  it('blocks unproven classifications and non-Core request kinds', () => {
    expect(evaluateDescriptorSafety(forged({ safetyClassification: 'READ_ONLY_EXPECTED' }))).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'CLASSIFICATION_NOT_PROVEN',
    }));
    expect(evaluateDescriptorSafety(forged({ requestKind: 'RAW_DIAGNOSTIC' }))).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'REQUEST_KIND_NOT_ALLOWED',
    }));
    expect(evaluateDescriptorSafety(forged({ requestKind: 'VENDOR_SPECIFIC' }))).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'REQUEST_KIND_NOT_ALLOWED',
    }));
    expect(evaluateDescriptorSafety(forged({ requestKind: 'UDS' }))).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'REQUEST_KIND_NOT_ALLOWED',
    }));
  });
});
