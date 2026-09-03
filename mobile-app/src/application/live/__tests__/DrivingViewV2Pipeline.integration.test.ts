import { routeLiveDecodedValues } from '../LiveDecodedSignalRouter';
import { resolveDrivingModePresentation } from '../../../domain/driver-intelligence/DrivingModeResolverV2';
import type { DrivingEvidenceObservation } from '../../../domain/driver-intelligence/DrivingEvidenceTrust';

const NOW = 50_000;

function toObservations(decodedValues: readonly { type: string; value: unknown; unit?: string }[]) {
  const observations: Record<string, DrivingEvidenceObservation> = {};
  routeLiveDecodedValues(decodedValues).forEach(reading => {
    observations[reading.signalId] = {
      signalId: reading.signalId,
      value: reading.value,
      unit: reading.unit,
      quality: 'VALID',
      origin: reading.signalId === 'ADAPTER_VOLTAGE' ? 'DEVICE_SENSOR' : 'ECU_DIRECT',
      observedAt: NOW,
    };
  });
  return observations;
}

describe('Driving View v2 decoded-signal pipeline', () => {
  it('promotes real engine load into Performance when the decoder provides it', () => {
    const observations = toObservations([
      { type: 'RPM', value: 2800, unit: 'rpm' },
      { type: 'ENGINE_LOAD', value: 63.4, unit: '%' },
      { type: 'COOLANT', value: 94, unit: '°C' },
      { type: 'SPEED', value: 72, unit: 'km/h' },
    ]);

    const presentation = resolveDrivingModePresentation('PERFORMANCE', observations, NOW + 100);

    expect(presentation.readiness).toBe('READY');
    expect(presentation.primary?.signalId).toBe('ENGINE_RPM');
    expect(presentation.secondaryA?.signalId).toBe('ENGINE_LOAD');
    expect(presentation.secondaryA?.label).toBe('ENGINE LOAD');
  });

  it('uses throttle as the truthful Power Demand fallback when load is absent', () => {
    const observations = toObservations([
      { type: 'RPM', value: 2400, unit: 'rpm' },
      { type: 'THROTTLE_POSITION', value: 27.5, unit: '%' },
      { type: 'COOLANT', value: 93, unit: '°C' },
    ]);

    const presentation = resolveDrivingModePresentation('PERFORMANCE', observations, NOW + 100);

    expect(presentation.secondaryA?.signalId).toBe('THROTTLE_POSITION');
    expect(presentation.secondaryA?.label).toBe('THROTTLE');
    expect(presentation.readiness).toBe('ADAPTIVE');
  });

  it('degrades safely instead of fabricating Power Demand when decoder evidence is invalid', () => {
    const observations = toObservations([
      { type: 'RPM', value: 2200, unit: 'rpm' },
      { type: 'ENGINE_LOAD', value: Number.NaN, unit: '%' },
      { type: 'THROTTLE_POSITION', value: '31', unit: '%' },
      { type: 'COOLANT', value: 92, unit: '°C' },
      { type: 'SPEED', value: 48, unit: 'km/h' },
    ]);

    const presentation = resolveDrivingModePresentation('PERFORMANCE', observations, NOW + 100);

    expect(presentation.readiness).toBe('ADAPTIVE');
    expect([
      presentation.primary?.signalId,
      presentation.secondaryA?.signalId,
      presentation.secondaryB?.signalId,
    ]).not.toContain('ENGINE_LOAD');
    expect([
      presentation.primary?.signalId,
      presentation.secondaryA?.signalId,
      presentation.secondaryB?.signalId,
    ]).not.toContain('THROTTLE_POSITION');
  });
});
