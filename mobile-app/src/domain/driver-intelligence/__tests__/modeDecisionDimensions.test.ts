import { resolveModeDecisionDimensions } from '..';

describe('Mode decision dimensions', () => {
  it('marks performance dimensions from the best evidence actually available', () => {
    const dimensions = resolveModeDecisionDimensions('PERFORMANCE', [
      { signalId: 'ENGINE_RPM', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ENGINE_COOLANT', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'THROTTLE_POSITION', origin: 'ECU_DIRECT', quality: 'DEGRADED' },
    ]);

    expect(dimensions.find(item => item.id === 'ENGINE_STATE')?.coverage).toBe('PARTIAL');
    expect(dimensions.find(item => item.id === 'THERMAL_STATE')?.coverage).toBe('PARTIAL');
    expect(dimensions.find(item => item.id === 'POWER_DEMAND')?.coverage).toBe('PARTIAL');
    expect(dimensions.find(item => item.id === 'AIRFLOW')?.coverage).toBe('UNKNOWN');
    expect(dimensions.find(item => item.id === 'ELECTRICAL')?.coverage).toBe('UNKNOWN');
  });

  it('keeps off-road terrain dimensions unknown until calibrated phone evidence exists', () => {
    const dimensions = resolveModeDecisionDimensions('OFF_ROAD', [
      { signalId: 'ENGINE_COOLANT', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ENGINE_RPM', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'PHONE_PITCH', origin: 'DEVICE_SENSOR', quality: 'VALID' },
      { signalId: 'PHONE_ROLL', origin: 'DEVICE_SENSOR', quality: 'VALID' },
    ]);

    expect(dimensions.find(item => item.id === 'ENGINE_STRESS')?.coverage).toBe('PARTIAL');
    expect(dimensions.find(item => item.id === 'INCLINE')?.coverage).toBe('UNKNOWN');
    expect(dimensions.find(item => item.id === 'ATTITUDE')?.coverage).toBe('UNKNOWN');
    expect(dimensions.find(item => item.id === 'ALTITUDE')?.coverage).toBe('UNKNOWN');
  });

  it('does not call degraded single-signal evidence READY', () => {
    const dimensions = resolveModeDecisionDimensions('OFF_ROAD', [
      { signalId: 'ALTITUDE', origin: 'DEVICE_SENSOR', quality: 'DEGRADED' },
      { signalId: 'PITCH', origin: 'DEVICE_SENSOR', quality: 'VALID' },
      { signalId: 'ROLL', origin: 'DEVICE_SENSOR', quality: 'VALID' },
    ]);

    expect(dimensions.find(item => item.id === 'ALTITUDE')?.coverage).toBe('PARTIAL');
    expect(dimensions.find(item => item.id === 'INCLINE')?.coverage).toBe('COVERED');
    expect(dimensions.find(item => item.id === 'ATTITUDE')?.coverage).toBe('COVERED');
  });
});