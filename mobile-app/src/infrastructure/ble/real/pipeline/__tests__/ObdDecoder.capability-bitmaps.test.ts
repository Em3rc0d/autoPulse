import { ObdDecoder } from '../ObdDecoder';
import { ObdFrame } from '../types';

function bitmapFrame(pid: string, bytes: number[]): ObdFrame {
  return {
    sourceAddress: '7E8',
    service: '41',
    pid,
    payloadBytes: bytes,
    declaredLength: null,
    rawLine: '',
    validity: 'VALID'
  };
}

describe('ObdDecoder capability bitmaps', () => {
  it.each([
    ['00', '0101', '0120'],
    ['20', '0121', '0140'],
    ['40', '0141', '0160'],
    ['60', '0161', '0180'],
    ['80', '0181', '01A0'],
    ['A0', '01A1', '01C0'],
    ['C0', '01C1', '01E0']
  ])('decodes bitmap %s without signed-integer or range-specific logic', (pid, firstPid, continuationPid) => {
    const decoded = ObdDecoder.decode([
      bitmapFrame(pid, [0x80, 0x00, 0x00, 0x01])
    ]);

    expect(decoded).toEqual([
      { type: 'BITMAP', value: [firstPid, continuationPid], unit: '' }
    ]);
  });

  it('does not decode an incomplete bitmap as capability truth', () => {
    expect(ObdDecoder.decode([bitmapFrame('60', [0x80, 0x00, 0x00])])).toEqual([]);
  });
});
