import { vehicleCheckEvidencePresentation } from '../VehicleCheckEvidenceSemantics';

describe('VehicleCheckEvidenceSemantics', () => {
  it('keeps observed session evidence available', () => {
    expect(vehicleCheckEvidencePresentation({ state: 'OBSERVED' }).semantic).toBe('AVAILABLE');
  });

  it('distinguishes queried no-data from not-observed', () => {
    expect(vehicleCheckEvidencePresentation({ state: 'PROBED_NO_DATA' }).semantic).toBe('UNAVAILABLE');
    expect(vehicleCheckEvidencePresentation({ state: 'NOT_EVALUATED' }).semantic).toBe('NOT_OBSERVED');
  });

  it('does not silently treat invalid attempts as unavailable', () => {
    expect(vehicleCheckEvidencePresentation({ state: 'INVALID_ONLY' }).semantic).toBe('ERROR');
  });
});
