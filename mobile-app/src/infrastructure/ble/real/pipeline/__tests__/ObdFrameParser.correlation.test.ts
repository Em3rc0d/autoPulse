import { ObdFrameParser } from '../ObdFrameParser';
import type { CommandRequest, ClassifiedLine } from '../types';

const request: CommandRequest = {
  id: 'pid-check', command: '010C', family: 'OBD_MODE_01',
  expectedService: '41', expectedPid: '0C', timeoutMs: 1500,
};
function candidate(hex: string): ClassifiedLine[] {
  return [{ originalText: hex, normalizedText: hex, classification: 'OBD_HEX_CANDIDATE' }];
}

describe('OBD response correlation', () => {
  it('accepts the requested PID and preserves the payload', () => {
    const result = ObdFrameParser.parse(candidate('410C1AF8'), request);
    expect(result.frames[0].validity).toBe('VALID');
    expect(result.frames[0].payloadBytes).toEqual([0x1A, 0xF8]);
  });
  it('rejects a valid-looking reply for another PID', () => {
    const result = ObdFrameParser.parse(candidate('410D3C'), request);
    expect(result.frames[0].validity).toBe('AMBIGUOUS');
    expect(result.frames[0].payloadBytes).toEqual([]);
  });
  it('rejects an incomplete byte sequence', () => {
    const result = ObdFrameParser.parse(candidate('410C1AF'), request);
    expect(result.frames[0].validity).toBe('INCOMPLETE');
  });
});
