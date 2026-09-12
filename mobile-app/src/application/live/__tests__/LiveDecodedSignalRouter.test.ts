import {
  parseInitialAdapterVoltage,
  routeLiveDecodedValues,
} from '../LiveDecodedSignalRouter';

describe('LiveDecodedSignalRouter', () => {
  it('routes all Driving View v2 live signals without relabeling them', () => {
    const result = routeLiveDecodedValues([
      { type: 'RPM', value: 2500, unit: 'RPM' },
      { type: 'SPEED', value: 61, unit: 'km/h' },
      { type: 'COOLANT', value: 94, unit: '°C' },
      { type: 'ENGINE_LOAD', value: 44.2, unit: '%' },
      { type: 'THROTTLE_POSITION', value: 18.8, unit: '%' },
      { type: 'ECU_VOLTAGE', value: 14.1, unit: 'V' },
      { type: 'ADAPTER_VOLTAGE', value: 12.6, unit: 'V' },
    ]);

    expect(result.map(item => item.signalId)).toEqual([
      'ENGINE_RPM',
      'VEHICLE_SPEED',
      'ENGINE_COOLANT',
      'ENGINE_LOAD',
      'THROTTLE_POSITION',
      'CONTROL_VOLTAGE',
      'ADAPTER_VOLTAGE',
    ]);
  });

  it('ignores unknown, non-numeric and non-finite values instead of coercing evidence', () => {
    expect(routeLiveDecodedValues([
      { type: 'MAP', value: 90, unit: 'kPa' },
      { type: 'RPM', value: '2500', unit: 'RPM' },
      { type: 'SPEED', value: Number.NaN, unit: 'km/h' },
      { type: 'BITMAP', value: ['010C'], unit: '' },
    ])).toEqual([]);
  });

  it('extracts only finite positive initial adapter voltage evidence', () => {
    expect(parseInitialAdapterVoltage('12.44V')).toBeCloseTo(12.44);
    expect(parseInitialAdapterVoltage(13.8)).toBeCloseTo(13.8);
    expect(parseInitialAdapterVoltage('NO DATA')).toBeNull();
    expect(parseInitialAdapterVoltage('-1V')).toBeNull();
    expect(parseInitialAdapterVoltage(Number.NaN)).toBeNull();
  });
});
