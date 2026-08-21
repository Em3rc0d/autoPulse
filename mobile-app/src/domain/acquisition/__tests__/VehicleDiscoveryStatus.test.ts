import { initializationEvidence } from '../VehicleParameterEvidence';
import { deriveVehicleDiscoveryStatus } from '../VehicleDiscoveryStatus';

describe('VehicleDiscoveryStatus', () => {
  it('fails when no advertised or successfully probed vehicle evidence exists', () => {
    expect(deriveVehicleDiscoveryStatus(
      [{ address: 0x7E8 }],
      [{
        evidence: initializationEvidence({
          definitionExists: true,
          advertised: false,
          probeResult: 'NO_DATA'
        })
      }]
    )).toBe('FAILED');
  });

  it('is partial when usable evidence has no attributable ECU source', () => {
    expect(deriveVehicleDiscoveryStatus(
      [{ address: -1 }],
      [{
        evidence: initializationEvidence({
          definitionExists: true,
          advertised: true
        })
      }]
    )).toBe('PARTIAL');
  });

  it('is partial when the vehicle advertises an undefined parameter', () => {
    expect(deriveVehicleDiscoveryStatus(
      [{ address: 0x7E8 }],
      [{
        evidence: initializationEvidence({
          definitionExists: false,
          advertised: true
        })
      }]
    )).toBe('PARTIAL');
  });

  it('completes with attributable standard evidence even when ECUs differ', () => {
    expect(deriveVehicleDiscoveryStatus(
      [{ address: 0x7E8 }, { address: 0x7E9 }],
      [
        { evidence: initializationEvidence({ definitionExists: true, advertised: true }) },
        { evidence: initializationEvidence({ definitionExists: true, advertised: false, probeResult: 'SUCCESS' }) }
      ]
    )).toBe('COMPLETED');
  });
});
