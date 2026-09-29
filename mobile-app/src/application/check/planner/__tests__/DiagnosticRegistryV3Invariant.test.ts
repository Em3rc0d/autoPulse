import { CHECK_CORE_DESCRIPTOR_REGISTRY_V3 } from '../DiagnosticDescriptorRegistryV3';
import { CHECK_MUTATING_OBD_SERVICES } from '../DiagnosticDescriptorRegistry';

/**
 * Registry-wide invariant: adding a descriptor to canonical V3 must not silently
 * widen the runtime safety envelope.
 */
describe('CHECK v4.1 Registry V3 invariants', () => {
  it('contains only serial read-only standard OBD descriptors and no mutating service', () => {
    for (const descriptor of CHECK_CORE_DESCRIPTOR_REGISTRY_V3.descriptors) {
      expect(descriptor.requestKind).toBe('OBD_STANDARD');
      expect(descriptor.safetyClassification).toBe('READ_ONLY_PROVEN');
      expect(descriptor.executionMode).toBe('SERIAL_ONLY');
      expect((CHECK_MUTATING_OBD_SERVICES as readonly string[])).not.toContain(descriptor.service);
      expect(descriptor.supportedProtocols).not.toContain('UNKNOWN');
      expect(descriptor.supportedProtocols).not.toContain('UDS');
    }
  });

  it('keeps every v4-added targeted Mode 01 descriptor restricted to KWP', () => {
    const targetedV4 = CHECK_CORE_DESCRIPTOR_REGISTRY_V3.descriptors.filter(
      descriptor => descriptor.descriptorId.startsWith('check-v4-mode01-observe-'),
    );
    expect(targetedV4).toHaveLength(10);
    for (const descriptor of targetedV4) {
      expect(descriptor.service).toBe('01');
      expect(descriptor.expectedResponseService).toBe('41');
      expect(descriptor.stage).toBe('TARGETED_PID_ACQUISITION');
      expect(descriptor.supportedProtocols).toEqual(['ISO_14230_KWP']);
    }
  });
});
