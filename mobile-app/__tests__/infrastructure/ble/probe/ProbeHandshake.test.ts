import { ProbeHandshake } from '../../../../src/infrastructure/ble/probe/ProbeHandshake';
import { CandidateCombination } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';

describe('ProbeHandshake', () => {
  it('should sanitize response properly', () => {
    // 1. Exact echo
    const res1 = ProbeHandshake.sanitizeResponse('ATI\r\r\nELM327 v1.5\r\n>', 'ATI\r');
    expect(res1.echo).toBe(true);
    expect(res1.prompt).toBe(true);
    expect(res1.sanitized).toBe('ELM327 v1.5');

    // 2. Fragmented/Weird spaces
    const res2 = ProbeHandshake.sanitizeResponse('\0 ELM327 \r\n v2.1 \r > \n', 'ATI\r');
    expect(res2.prompt).toBe(true);
    expect(res2.echo).toBe(false);
    expect(res2.sanitized).toBe('ELM327 v2.1');

    // 3. No prompt, no echo
    const res3 = ProbeHandshake.sanitizeResponse('OBDII', 'ATI\r');
    expect(res3.prompt).toBe(false);
    expect(res3.echo).toBe(false);
    expect(res3.sanitized).toBe('OBDII');
  });
});
