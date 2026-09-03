import { resolveDrivingModePresentation } from '../DrivingModeResolverV2';
import type { DrivingEvidenceObservation } from '../DrivingEvidenceTrust';

const obs = (
  signalId: string,
  value: number,
  observedAt = 10_000,
  extra: Partial<DrivingEvidenceObservation> = {},
): DrivingEvidenceObservation => ({
  signalId,
  value,
  observedAt,
  quality: 'VALID',
  origin: 'ECU_DIRECT',
  ...extra,
});

describe('DrivingModeResolverV2', () => {
  it('keeps Performance useful and ADAPTIVE when load/throttle are absent', () => {
    const observations = {
      ENGINE_RPM: obs('ENGINE_RPM', 2850, 10_000, { unit: 'rpm' }),
      ENGINE_COOLANT: obs('ENGINE_COOLANT', 91, 10_000, { unit: '°C' }),
      VEHICLE_SPEED: obs('VEHICLE_SPEED', 62, 10_000, { unit: 'km/h' }),
    };
    const result = resolveDrivingModePresentation('PERFORMANCE', observations, 10_100);
    expect(result.readiness).toBe('ADAPTIVE');
    expect(result.primary?.signalId).toBe('ENGINE_RPM');
    expect(result.secondaryA?.signalId).toBe('ENGINE_COOLANT');
    expect(result.secondaryB?.signalId).toBe('VEHICLE_SPEED');
  });

  it('does not use raw or merely calibrated phone attitude as vehicle attitude without mount continuity', () => {
    const observations = {
      PITCH: obs('PITCH', 11, 10_000, {
        unit: '°',
        origin: 'DEVICE_SENSOR',
        calibration: 'VEHICLE_CALIBRATED',
      }),
      HEADING: obs('HEADING', 247, 10_000, { unit: '°', origin: 'DEVICE_SENSOR' }),
      ALTITUDE: obs('ALTITUDE', 159, 10_000, { unit: 'm', origin: 'DEVICE_SENSOR' }),
      VEHICLE_SPEED: obs('VEHICLE_SPEED', 9, 10_000, { unit: 'km/h' }),
    };
    const result = resolveDrivingModePresentation('OFF_ROAD', observations, 10_100);
    expect(result.primary?.signalId).toBe('HEADING');
    expect(result.primary?.label).toBe('PHONE HEADING');
    expect(result.readiness).toBe('ADAPTIVE');
  });

  it('permits calibrated attitude only when mount continuity is explicitly valid', () => {
    const observations = {
      PITCH: obs('PITCH', 8, 10_000, {
        unit: '°', origin: 'DEVICE_SENSOR', calibration: 'VEHICLE_CALIBRATED', mountContinuity: 'VALID',
      }),
      ROLL: obs('ROLL', -2, 10_000, {
        unit: '°', origin: 'DEVICE_SENSOR', calibration: 'VEHICLE_CALIBRATED', mountContinuity: 'VALID',
      }),
      VEHICLE_SPEED: obs('VEHICLE_SPEED', 12, 10_000, { unit: 'km/h' }),
    };
    const result = resolveDrivingModePresentation('OFF_ROAD', observations, 10_100);
    expect(result.primary?.signalId).toBe('PITCH');
    expect(result.primary?.label).toBe('PITCH');
  });

  it('never duplicates one evidence signal across slots', () => {
    const observations = {
      ENGINE_RPM: obs('ENGINE_RPM', 2000),
      ENGINE_COOLANT: obs('ENGINE_COOLANT', 90),
      VEHICLE_SPEED: obs('VEHICLE_SPEED', 40),
    };
    const result = resolveDrivingModePresentation('ESSENTIAL', observations, 10_100);
    const ids = [result.primary?.signalId, result.secondaryA?.signalId, result.secondaryB?.signalId].filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports LIMITED instead of fabricating missing metrics for a one-signal vehicle', () => {
    const result = resolveDrivingModePresentation('PERFORMANCE', {
      ENGINE_RPM: obs('ENGINE_RPM', 1800),
    }, 10_100);
    expect(result.readiness).toBe('LIMITED');
    expect(result.primary?.signalId).toBe('ENGINE_RPM');
    expect(result.secondaryA).toBeUndefined();
  });
});
