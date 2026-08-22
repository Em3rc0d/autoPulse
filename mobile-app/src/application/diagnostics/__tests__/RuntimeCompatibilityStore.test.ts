import { runtimeCompatibilityStore } from '../RuntimeCompatibilityStore';
import { createCompatibilitySnapshot } from '../../../domain/diagnostics';

describe('RuntimeCompatibilityStore', () => {
  afterEach(() => runtimeCompatibilityStore.clear());

  it('keeps compatibility evidence isolated per live session', () => {
    const snapshot = createCompatibilitySnapshot({
      capturedAt: 1,
      connector: { transport: 'BLE', family: 'ELM327_COMPATIBLE' },
      connectorCapabilities: {
        requestKinds: ['OBD_STANDARD'],
        protocols: ['UNKNOWN'],
        supportsAutomaticProtocolDiscovery: true,
        supportsRawDiagnosticRequests: true,
        supportsMultipleEcus: true,
      },
      connectorHealth: { connected: true, reliability: 'GOOD' },
    });

    runtimeCompatibilityStore.set('session-a', snapshot);

    expect(runtimeCompatibilityStore.get('session-a')).toBe(snapshot);
    expect(runtimeCompatibilityStore.get('session-b')).toBeUndefined();

    runtimeCompatibilityStore.remove('session-a');
    expect(runtimeCompatibilityStore.get('session-a')).toBeUndefined();
  });
});
