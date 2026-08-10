import { resolveDrivingModeSignals } from '../DrivingModes';
import * as ObdSignalRegistry from '../ObdSignalRegistry';

describe('DrivingModes Resolver', () => {
  let isProductSignalSupportedSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on the registry function to control what AutoPulse 'knows' how to decode
    isProductSignalSupportedSpy = jest.spyOn(ObdSignalRegistry, 'isProductSignalSupported');
    // Default: all canonical signals are supported
    isProductSignalSupportedSpy.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GENERAL yields the fixed classic four', () => {
    const available = new Set(['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'CONTROL_MODULE_VOLTAGE']);
    const selected = resolveDrivingModeSignals('GENERAL', available, 4);
    expect(selected).toEqual(['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'CONTROL_MODULE_VOLTAGE']);
  });

  it('GENERAL uses ADAPTER_VOLTAGE if CONTROL_MODULE_VOLTAGE is missing', () => {
    const available = new Set(['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT']);
    const selected = resolveDrivingModeSignals('GENERAL', available, 4);
    expect(selected).toEqual(['ENGINE_RPM', 'VEHICLE_SPEED', 'ENGINE_COOLANT', 'ADAPTER_VOLTAGE']);
  });

  it('PERFORMANCE selects the first 4 available preferred signals', () => {
    const available = new Set(['ENGINE_RPM', 'ENGINE_LOAD', 'THROTTLE_POSITION', 'MAP']);
    const selected = resolveDrivingModeSignals('PERFORMANCE', available, 4);
    expect(selected).toEqual(['ENGINE_RPM', 'ENGINE_LOAD', 'THROTTLE_POSITION', 'MAP']);
  });

  it('PERFORMANCE skips unavailable signals and finds the next eligible', () => {
    // THROTTLE_POSITION is missing
    const available = new Set(['ENGINE_RPM', 'ENGINE_LOAD', 'MAP', 'ENGINE_COOLANT', 'INTAKE_TEMP']);
    const selected = resolveDrivingModeSignals('PERFORMANCE', available, 4);
    expect(selected).toEqual(['ENGINE_RPM', 'ENGINE_LOAD', 'MAP', 'ENGINE_COOLANT']);
  });

  it('OFF_ROAD skips OEM-only signals that the vehicle might support but AutoPulse cannot decode', () => {
    // Vehicle supports 4WD_STATE, but AutoPulse decoder does not
    const available = new Set(['ENGINE_COOLANT', 'ENGINE_LOAD', '4WD_STATE', 'MAP', 'ENGINE_RPM']);
    
    isProductSignalSupportedSpy.mockImplementation((id: string) => {
      return id !== '4WD_STATE'; // simulate 4WD_STATE not decodable
    });

    const selected = resolveDrivingModeSignals('OFF_ROAD', available, 4);
    expect(selected).not.toContain('4WD_STATE');
    expect(selected).toEqual(['ENGINE_COOLANT', 'ENGINE_LOAD', 'ADAPTER_VOLTAGE', 'MAP']);
  });

  it('returns fewer than maxSignals if not enough are eligible', () => {
    const available = new Set(['ENGINE_RPM', 'ENGINE_COOLANT']);
    const selected = resolveDrivingModeSignals('PERFORMANCE', available, 4);
    expect(selected).toHaveLength(2);
    expect(selected).toEqual(['ENGINE_RPM', 'ENGINE_COOLANT']);
  });

  it('never invents a signal that is neither supported by the ECU nor the Adapter', () => {
    const available = new Set(['ENGINE_RPM']);
    const selected = resolveDrivingModeSignals('GENERAL', available, 4);
    // GENERAL prefers [RPM, SPEED, COOLANT, CONTROL_MODULE_VOLTAGE, ADAPTER_VOLTAGE]
    // ADAPTER_VOLTAGE is always considered available by the resolver (it doesn't need ECU support).
    expect(selected).toEqual(['ENGINE_RPM', 'ADAPTER_VOLTAGE']);
  });
});
