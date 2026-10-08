import { CHECK_CORE_DESCRIPTOR_REGISTRY_V3, CHECK_V4_TARGETED_MODE01_PIDS } from '../DiagnosticDescriptorRegistryV3';
import { CHECK_MUTATING_OBD_SERVICES } from '../DiagnosticDescriptorRegistry';

/**
 * Registry-wide invariant: adding a descriptor to canonical V3 must not silently
 * widen the runtime safety envelope.
 */
describe('CHECK v5 Registry V3 invariants', () => {
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

  it('keeps every adaptive Mode 01 descriptor read-only and limited to standard OBD protocols', () => {
    const targeted = CHECK_CORE_DESCRIPTOR_REGISTRY_V3.descriptors.filter(
      descriptor => descriptor.descriptorId.startsWith('check-v5-mode01-observe-'),
    );
    expect(targeted).toHaveLength(CHECK_V4_TARGETED_MODE01_PIDS.length);
    for (const descriptor of targeted) {
      expect(descriptor.service).toBe('01');
      expect(descriptor.expectedResponseService).toBe('41');
      expect(descriptor.stage).toBe('TARGETED_PID_ACQUISITION');
      expect(descriptor.supportedProtocols).toEqual([
        'ISO_15765_CAN',
        'ISO_14230_KWP',
        'ISO_9141_2',
        'SAE_J1850_PWM',
        'SAE_J1850_VPW',
      ]);
      expect(descriptor.supportedProtocols).not.toContain('UDS');
      expect(descriptor.supportedProtocols).not.toContain('UNKNOWN');
    }
  });
});
