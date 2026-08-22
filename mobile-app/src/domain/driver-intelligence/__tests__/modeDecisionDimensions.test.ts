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

  it('keeps off-road terrain dimensions unknown until phone evidence exists', () => {
    const dimensions = resolveModeDecisionDimensions('OFF_ROAD', [
      { signalId: 'ENGINE_COOLANT', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ENGINE_RPM', origin: 'ECU_DIRECT', quality: 'VALID' },
    ]);

    expect(dimensions.find(item => item.id === 'ENGINE_STRESS')?.coverage).toBe('PARTIAL');
    expect(dimensions.find(item => item.id === 'INCLINE')?.coverage).toBe('UNKNOWN');
    expect(dimensions.find(item => item.id === 'ATTITUDE')?.coverage).toBe('UNKNOWN');
    expect(dimensions.find(item => item.id === 'ALTITUDE')?.coverage).toBe('UNKNOWN');
  });
});
