import { classifyLiveCharacterization, resolveStartupEvidenceGate } from '../LiveStartupReadiness';
import type { DriverSignalObservation } from '../../../screens/live/components/DriverModeContext';

const sample = (overrides: Partial<DriverSignalObservation> = {}): DriverSignalObservation => ({
  signalId: 'ENGINE_RPM',
  value: 850,
  origin: 'ECU_DIRECT',
  quality: 'VALID',
  observedAt: 10_000,
  firstObservedAt: 9_000,
  firstValue: 800,
  sampleCount: 5,
  ...overrides,
});

describe('Live startup evidence gate', () => {
  it('does not promote a characterization unless standard OBD reachability was observed', () => {
    expect(classifyLiveCharacterization([])).toBe('LIMITED');
    expect(classifyLiveCharacterization([{ key: 'standard_obd_reachable', supported: false }])).toBe('LIMITED');
    expect(classifyLiveCharacterization([{ key: 'standard_obd_reachable', supported: true }])).toBe('VERIFIED');
  });

  it('does not treat completion of a UI or BLE handshake as an ECU connection', () => {
    expect(resolveStartupEvidenceGate({
      nowMs: 10_500, characterizationStatus: 'VERIFIED',
    })).toEqual({ ecuEvidenceCurrent: false, readOnlyCharacterizationVerified: true });
  });

  it('distinguishes valid ECU data from stale or device-origin values', () => {
    expect(resolveStartupEvidenceGate({
      rpm: sample({ observedAt: 1_000 }),
      nowMs: 10_500, characterizationStatus: 'VERIFIED',
    }).ecuEvidenceCurrent).toBe(false);
    expect(resolveStartupEvidenceGate({
      rpm: sample({ origin: 'DEVICE_SENSOR' }),
      nowMs: 10_500, characterizationStatus: 'VERIFIED',
    }).ecuEvidenceCurrent).toBe(false);
    expect(resolveStartupEvidenceGate({
      rpm: sample(),
      nowMs: 10_500, characterizationStatus: 'FAILED',
    })).toEqual({ ecuEvidenceCurrent: true, readOnlyCharacterizationVerified: false });
  });
});
