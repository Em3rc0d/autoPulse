import {
  getNextCapabilityCommand,
  isMode01CapabilityCommand,
  MODE_01_CAPABILITY_COMMANDS
} from '../Mode01CapabilityDiscovery';

describe('Mode01CapabilityDiscovery', () => {
  it('defines the complete bounded Release-1 discovery chain', () => {
    expect(MODE_01_CAPABILITY_COMMANDS).toEqual([
      '0100', '0120', '0140', '0160', '0180', '01A0', '01C0'
    ]);
  });

  it.each([
    ['0100', '0120'],
    ['0120', '0140'],
    ['0140', '0160'],
    ['0160', '0180'],
    ['0180', '01A0'],
    ['01A0', '01C0']
  ] as const)('continues after %s only when %s is advertised', (command, continuation) => {
    expect(getNextCapabilityCommand(command, [continuation])).toBe(continuation);
    expect(getNextCapabilityCommand(command, [])).toBeNull();
  });

  it('stops after the final bounded range', () => {
    expect(getNextCapabilityCommand('01C0', ['01E0'])).toBeNull();
  });

  it('recognizes capability commands without accepting arbitrary PIDs', () => {
    expect(isMode01CapabilityCommand('0180')).toBe(true);
    expect(isMode01CapabilityCommand('010C')).toBe(false);
  });
});
