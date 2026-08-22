import { evaluateContextualDriverAdvisories } from '../ContextualDriverAdvisories';

describe('ContextualDriverAdvisories', () => {
  it('warns on high RPM while directly observed coolant is still cold', () => {
    const advisories = evaluateContextualDriverAdvisories({
      ENGINE_RPM: { signalId: 'ENGINE_RPM', value: 3400, quality: 'VALID', origin: 'ECU_DIRECT', unit: 'rpm' },
      ENGINE_COOLANT: { signalId: 'ENGINE_COOLANT', value: 48, quality: 'VALID', origin: 'ECU_DIRECT', unit: '°C' },
    }, 1000);

    expect(advisories[0].id).toBe('context:cold-engine:high-rpm');
    expect(advisories[0].severity).toBe('WARNING');
    expect(advisories[0].evidence).toHaveLength(2);
  });

  it('does not manufacture a cold-engine warning when coolant is unavailable', () => {
    const advisories = evaluateContextualDriverAdvisories({
      ENGINE_RPM: { signalId: 'ENGINE_RPM', value: 4000, quality: 'VALID', origin: 'ECU_DIRECT', unit: 'rpm' },
    }, 1000);

    expect(advisories.some(item => item.id === 'context:cold-engine:high-rpm')).toBe(false);
  });

  it('raises critical thermal advisory only from observed coolant evidence', () => {
    const advisories = evaluateContextualDriverAdvisories({
      ENGINE_COOLANT: { signalId: 'ENGINE_COOLANT', value: 118, quality: 'VALID', origin: 'ECU_DIRECT', unit: '°C' },
    }, 1000);

    expect(advisories[0].id).toBe('context:coolant:critical');
    expect(advisories[0].severity).toBe('CRITICAL');
  });
});
