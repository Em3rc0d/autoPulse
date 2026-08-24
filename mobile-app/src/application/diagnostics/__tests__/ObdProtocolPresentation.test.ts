import { presentObdProtocol, presentSourceEcu } from '../ObdProtocolPresentation';

describe('ObdProtocolPresentation', () => {
  it('does not expose A0 as a resolved vehicle protocol', () => {
    expect(presentObdProtocol('A0')).toEqual({
      label: 'Automatic detection',
      detail: 'Resolved vehicle protocol was not captured.',
      resolved: false,
    });
  });

  it('maps an auto-detected ELM protocol number to human language', () => {
    expect(presentObdProtocol('A6')).toEqual({
      label: 'ISO 15765-4 CAN · 11-bit · 500 kbit/s',
      detail: 'Auto-detected by adapter.',
      resolved: true,
    });
  });

  it('preserves human-readable ATDP evidence', () => {
    expect(presentObdProtocol('ISO 9141-2').label).toBe('ISO 9141-2');
  });

  it('does not leak the unknown ECU storage sentinel', () => {
    expect(presentSourceEcu(-1)).toBe('Not identified');
    expect(presentSourceEcu(0x7e8)).toBe('7E8');
  });
});
