import { ObdDecoder } from '../pipeline/ObdDecoder';
import { ObdFrame } from '../pipeline/types';

describe('ObdDecoder', () => {
  it('decodes Engine Load (0104)', () => {
    const frame = { validity: 'VALID', pid: '04', service: '41', payloadBytes: [0xFF] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual({ type: 'ENGINE_LOAD', value: 100, unit: '%' });
  });

  it('decodes MAP (010B)', () => {
    const frame = { validity: 'VALID', pid: '0B', service: '41', payloadBytes: [0x64] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0]).toEqual({ type: 'MAP', value: 100, unit: 'kPa' });
  });

  it('decodes Timing Advance (010E)', () => {
    const frame = { validity: 'VALID', pid: '0E', service: '41', payloadBytes: [0x80] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0]).toEqual({ type: 'TIMING_ADVANCE', value: 0, unit: 'deg' });
  });

  it('decodes Intake Temp (010F)', () => {
    const frame = { validity: 'VALID', pid: '0F', service: '41', payloadBytes: [0x50] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0]).toEqual({ type: 'INTAKE_TEMP', value: 40, unit: '°C' });
  });

  it('decodes MAF (0110)', () => {
    const frame = { validity: 'VALID', pid: '10', service: '41', payloadBytes: [0x01, 0xF4] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0]).toEqual({ type: 'MAF', value: 5.00, unit: 'g/s' });
  });

  it('decodes Throttle (0111)', () => {
    const frame = { validity: 'VALID', pid: '11', service: '41', payloadBytes: [0xFF] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0]).toEqual({ type: 'THROTTLE_POSITION', value: 100, unit: '%' });
  });

  it('decodes Fuel Level (012F)', () => {
    const frame = { validity: 'VALID', pid: '2F', service: '41', payloadBytes: [0x80] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0].type).toBe('FUEL_LEVEL');
    expect(decoded[0].value).toBeCloseTo(50.196, 2);
    expect(decoded[0].unit).toBe('%');
  });

  it('decodes Oil Temp (015C)', () => {
    const frame = { validity: 'VALID', pid: '5C', service: '41', payloadBytes: [0x64] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded[0]).toEqual({ type: 'ENGINE_OIL_TEMP', value: 60, unit: '°C' });
  });

  it('ignores truncated payload for 2-byte responses (RPM)', () => {
    const frame = { validity: 'VALID', pid: '0C', service: '41', payloadBytes: [0xFF] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded).toHaveLength(0); // Cannot decode 1 byte for RPM
  });

  it('ignores wrong PID', () => {
    const frame = { validity: 'VALID', pid: '99', service: '41', payloadBytes: [0xFF] } as ObdFrame;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded).toHaveLength(0);
  });

  it('ignores invalid validity', () => {
    const frame = { validity: 'MALFORMED', pid: '0C', service: '41', payloadBytes: [0xFF, 0xFF] } as any;
    const decoded = ObdDecoder.decode([frame]);
    expect(decoded).toHaveLength(0);
  });
});
