import { authorizeRegisteredDescriptor } from '../DiagnosticCommandSafetyPolicy';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V2,
  createDiagnosticDescriptorRegistry,
} from '../DiagnosticDescriptorRegistry';

describe('direct Mode 01 descriptor safety', () => {
  test.each([
    'check.obd.mode01.observe.05',
    'check.obd.mode01.observe.0C',
    'check.obd.mode01.observe.0D',
  ])('%s is authorized only on the promoted KWP path', semanticId => {
    expect(authorizeRegisteredDescriptor(
      CHECK_CORE_DESCRIPTOR_REGISTRY_V2,
      semanticId,
      'ISO_14230_KWP',
    ).disposition).toBe('ALLOW');

    const canDecision = authorizeRegisteredDescriptor(
      CHECK_CORE_DESCRIPTOR_REGISTRY_V2,
      semanticId,
      'ISO_15765_CAN',
    );
    expect(canDecision.disposition).toBe('BLOCK');
    if (canDecision.disposition === 'BLOCK') expect(canDecision.reason).toBe('PROTOCOL_NOT_PROMOTED');
  });

  test('an alternate registry version cannot mint a direct read', () => {
    const alternate = createDiagnosticDescriptorRegistry(
      'attacker-registry/v1',
      CHECK_CORE_DESCRIPTOR_REGISTRY_V2.descriptors,
    );
    const decision = authorizeRegisteredDescriptor(alternate, 'check.obd.mode01.observe.05', 'ISO_14230_KWP');
    expect(decision.disposition).toBe('BLOCK');
    if (decision.disposition === 'BLOCK') expect(decision.reason).toBe('REGISTRY_NOT_ALLOWLISTED');
  });

  test('a tampered canonical-v2 descriptor is rejected even if marked READ_ONLY_PROVEN', () => {
    const tampered = createDiagnosticDescriptorRegistry(
      CHECK_CORE_DESCRIPTOR_REGISTRY_V2.version,
      CHECK_CORE_DESCRIPTOR_REGISTRY_V2.descriptors.map(item => item.semanticId === 'check.obd.mode01.observe.05'
        ? { ...item, provenance: `${item.provenance};tampered` }
        : item),
    );
    const decision = authorizeRegisteredDescriptor(tampered, 'check.obd.mode01.observe.05', 'ISO_14230_KWP');
    expect(decision.disposition).toBe('BLOCK');
    if (decision.disposition === 'BLOCK') expect(decision.reason).toBe('DESCRIPTOR_DEFINITION_MISMATCH');
  });
});
