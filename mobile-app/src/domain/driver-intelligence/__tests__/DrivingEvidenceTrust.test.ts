import { isTrustedFor, type DrivingEvidenceObservation } from '../DrivingEvidenceTrust';

const observation = (overrides: Partial<DrivingEvidenceObservation> = {}): DrivingEvidenceObservation => ({
  signalId: 'ENGINE_RPM',
  value: 1800,
  quality: 'VALID',
  origin: 'ECU_DIRECT',
  observedAt: 10_000,
  ...overrides,
});

describe('DrivingEvidenceTrust', () => {
  it('does not let stale evidence remain decisionable', () => {
    expect(isTrustedFor(observation(), 'DECISIONABLE', 20_001)).toBe(false);
  });

  it('allows raw phone attitude to be displayed but not used as vehicle attitude', () => {
    const pitch = observation({ signalId: 'PHONE_PITCH', value: -17, origin: 'DEVICE_SENSOR' });
    expect(isTrustedFor(pitch, 'PRESENTABLE', 10_100)).toBe(true);
    expect(isTrustedFor(pitch, 'DECISIONABLE', 10_100)).toBe(false);
  });

  it('requires calibration and mount continuity before vehicle pitch becomes decisionable', () => {
    const pitch = observation({
      signalId: 'PITCH', value: 8, origin: 'DEVICE_SENSOR', calibration: 'VEHICLE_CALIBRATED',
    });
    expect(isTrustedFor(pitch, 'DECISIONABLE', 10_100)).toBe(false);
    expect(isTrustedFor({ ...pitch, mountContinuity: 'VALID' }, 'DECISIONABLE', 10_100)).toBe(true);
  });

  it('keeps off-road attitude out of generic safety alerting even when trusted for decisions', () => {
    const pitch = observation({
      signalId: 'PITCH', value: 8, origin: 'DEVICE_SENSOR', calibration: 'VEHICLE_CALIBRATED', mountContinuity: 'VALID',
    });
    expect(isTrustedFor(pitch, 'ALERTABLE', 10_100)).toBe(false);
  });
});
