import {
  assessVehicleDocument,
  buildStartupBriefing,
  evaluateDriverAdvisories,
  resolveDrivingMode,
} from '..';

describe('Driver Intelligence foundation', () => {
  const now = Date.parse('2026-08-21T12:00:00Z');

  it('builds Performance from the signals the vehicle really exposes', () => {
    const result = resolveDrivingMode('PERFORMANCE', [
      { signalId: 'ENGINE_RPM', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ENGINE_COOLANT', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ENGINE_LOAD', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'THROTTLE_POSITION', origin: 'ECU_DIRECT', quality: 'DEGRADED' },
      { signalId: 'OIL_TEMP', origin: 'ECU_DIRECT', quality: 'UNAVAILABLE' },
    ]);

    expect(result.selectedSignals.map(signal => signal.signalId)).toEqual([
      'ENGINE_RPM',
      'THROTTLE_POSITION',
      'ENGINE_LOAD',
      'ENGINE_COOLANT',
    ]);
    expect(result.missingPreferredSignals).toContain('OIL_TEMP');
    expect(result.degraded).toBe(true);
  });

  it('can combine ECU and phone-origin signals in Off-Road without mixing provenance', () => {
    const result = resolveDrivingMode('OFF_ROAD', [
      { signalId: 'ENGINE_COOLANT', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ENGINE_LOAD', origin: 'ECU_DIRECT', quality: 'VALID' },
      { signalId: 'ALTITUDE', origin: 'DEVICE_SENSOR', quality: 'VALID' },
      { signalId: 'PITCH', origin: 'DEVICE_SENSOR', quality: 'VALID' },
      { signalId: 'ROLL', origin: 'DEVICE_SENSOR', quality: 'VALID' },
    ]);

    expect(result.selectedSignals.find(signal => signal.signalId === 'PITCH')?.origin).toBe('DEVICE_SENSOR');
    expect(result.selectedSignals.find(signal => signal.signalId === 'ENGINE_COOLANT')?.origin).toBe('ECU_DIRECT');
  });

  it('classifies document expiry locally without an online lookup', () => {
    const assessment = assessVehicleDocument({
      type: 'CITV',
      expiresAt: '2026-09-08T12:00:00Z',
      source: 'DOCUMENT_PHOTO',
      verifiedByUser: true,
    }, now);

    expect(assessment.status).toBe('DUE_SOON');
    expect(assessment.daysRemaining).toBe(18);
  });

  it('creates evidence-backed DTC and CITV advisories and a startup voice briefing', () => {
    const advisories = evaluateDriverAdvisories({
      nowMs: now,
      health: {
        mil: 'ON',
        freezeFrameAvailable: true,
        dtcs: [{
          code: 'P0302',
          status: 'CONFIRMED',
          description: 'Cylinder two misfire detected',
        }],
      },
      documents: [{
        type: 'CITV',
        expiresAt: '2026-09-08T12:00:00Z',
        source: 'MANUAL_ENTRY',
        verifiedByUser: true,
      }],
    });

    expect(advisories[0].id).toBe('dtc:CONFIRMED:P0302');
    expect(advisories[0].severity).toBe('WARNING');
    expect(advisories.some(item => item.id === 'document:CITV:due')).toBe(true);

    const briefing = buildStartupBriefing(advisories);
    expect(briefing.headline).toBe('1 important warning');
    expect(briefing.voiceMessage).toContain('AutoPulse ready.');
    expect(briefing.voiceMessage).toContain('Cylinder two misfire detected');
    expect(briefing.voiceMessage).toContain('CITV expires in 18 days.');
  });

  it('does not invent a document state when no expiration date exists', () => {
    const assessment = assessVehicleDocument({
      type: 'SOAT',
      source: 'MANUAL_ENTRY',
      verifiedByUser: false,
    }, now);

    expect(assessment.status).toBe('UNKNOWN');
    expect(assessment.daysRemaining).toBeNull();
  });
});
