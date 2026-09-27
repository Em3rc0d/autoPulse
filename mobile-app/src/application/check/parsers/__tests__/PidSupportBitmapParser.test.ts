import { parsePidSupportBitmap } from '../PidSupportBitmapParser';

describe('CHECK-MK4 PID support bitmap parser', () => {
  it.each([
    ['0100', '0101', '0120', '0120'],
    ['0120', '0121', '0140', '0140'],
    ['0140', '0141', '0160', '0160'],
    ['0160', '0161', '0180', '0180'],
    ['0180', '0181', '01A0', '01A0'],
    ['01A0', '01A1', '01C0', '01C0'],
    ['01C0', '01C1', '01E0', null],
  ] as const)('decodes %s as endpoint capability evidence', (command, firstPid, lastPid, continuation) => {
    const result = parsePidSupportBitmap(command, [0x80, 0x00, 0x00, 0x01]);
    expect(result.outcome).toBe('VALID');
    expect(result.advertisedPids).toEqual([firstPid, lastPid]);
    expect(result.continuationCommand).toBe(continuation);
  });

  it('does not continue when the next support block is not advertised', () => {
    const result = parsePidSupportBitmap('0100', [0x80, 0x00, 0x00, 0x00]);
    expect(result.advertisedPids).toEqual(['0101']);
    expect(result.continuationCommand).toBeNull();
  });

  it('fails closed on incomplete, oversized or invalid-byte bitmaps', () => {
    expect(parsePidSupportBitmap('0100', [0x80, 0x00, 0x00]).outcome).toBe('INVALID');
    expect(parsePidSupportBitmap('0100', [0x80, 0x00, 0x00, 0x00, 0x00]).outcome).toBe('INVALID');
    expect(parsePidSupportBitmap('0100', [0x80, 0x00, 0x00, 0x100]).outcome).toBe('INVALID');
  });

  it('returns an empty advertised set for a valid all-zero bitmap', () => {
    const result = parsePidSupportBitmap('0100', [0x00, 0x00, 0x00, 0x00]);
    expect(result.outcome).toBe('VALID');
    expect(result.advertisedPids).toEqual([]);
    expect(result.continuationCommand).toBeNull();
  });
});
