import { initializationEvidence } from '../VehicleParameterEvidence';

describe('VehicleParameterEvidence', () => {
  it('keeps advertisement independent from a successful probe', () => {
    expect(initializationEvidence({
      definitionExists: true,
      advertised: false,
      probeResult: 'SUCCESS'
    })).toEqual({
      standardDefinition: 'DEFINED',
      capabilityAdvertised: 'NOT_ADVERTISED',
      probeResult: 'SUCCESS',
      liveObservation: 'NOT_OBSERVED'
    });
  });

  it('does not manufacture a live observation during initialization', () => {
    expect(initializationEvidence({
      definitionExists: true,
      advertised: true,
      probeResult: 'SUCCESS'
    }).liveObservation).toBe('NOT_OBSERVED');
  });

  it('preserves unknown advertisement and definition truth', () => {
    expect(initializationEvidence({
      definitionExists: false,
      advertised: null
    })).toEqual({
      standardDefinition: 'UNDEFINED',
      capabilityAdvertised: 'UNKNOWN',
      probeResult: 'NOT_PROBED',
      liveObservation: 'NOT_OBSERVED'
    });
  });
});
