import { ProbeHandshake } from '../../../../src/infrastructure/ble/probe/ProbeHandshake';
import { CandidateCombination } from '../../../../src/infrastructure/ble/probe/CharacteristicCandidateSelector';

describe('ProbeHandshake', () => {
  it('clears READ-only poll timer when command times out', async () => {
    jest.useFakeTimers();
    try {
      const combo = {
        writeCharacteristic: { serviceUuid: 'fff0', uuid: 'fff1', isWritableWithResponse: true },
        receiveCharacteristic: { serviceUuid: 'fff0', uuid: 'fff2', isNotifiable: false, isIndicatable: false, isReadable: true },
      } as unknown as CandidateCombination;
      const device = {
        writeCharacteristicWithResponseForService: jest.fn().mockResolvedValue({}),
        readCharacteristicForService: jest.fn().mockResolvedValue({ value: null }),
      } as any;
      const pending = ProbeHandshake.execute(device, combo, 'ATI\\r', 100, { cancelled: false });
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(101);
      expect((await pending).timedOut).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

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
