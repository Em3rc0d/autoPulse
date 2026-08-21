import { decodeAdapterVoltage } from '../AdapterVoltage';

describe('AdapterVoltage', () => {
  it('decodes an ELM ATRV response as adapter-origin voltage', () => {
    expect(decodeAdapterVoltage('ATRV\r12.6V\r>')).toEqual({
      type: 'ADAPTER_VOLTAGE',
      origin: 'ADAPTER',
      value: 12.6,
      unit: 'V'
    });
  });

  it.each(['', 'NO DATA', '?', 'V', '12.xV'])(
    'does not turn missing or invalid adapter voltage into zero: %s',
    response => {
      expect(decodeAdapterVoltage(response)).toBeNull();
    }
  );
});
