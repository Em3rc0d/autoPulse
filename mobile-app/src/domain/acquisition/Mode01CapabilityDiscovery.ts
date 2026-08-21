export const MODE_01_CAPABILITY_COMMANDS = [
  '0100',
  '0120',
  '0140',
  '0160',
  '0180',
  '01A0',
  '01C0'
] as const;

export type Mode01CapabilityCommand = typeof MODE_01_CAPABILITY_COMMANDS[number];

const CONTINUATION_PID_BY_COMMAND: Readonly<Record<Mode01CapabilityCommand, string | null>> = {
  '0100': '0120',
  '0120': '0140',
  '0140': '0160',
  '0160': '0180',
  '0180': '01A0',
  '01A0': '01C0',
  '01C0': null
};

export function getNextCapabilityCommand(
  currentCommand: Mode01CapabilityCommand,
  advertisedPids: readonly string[]
): Mode01CapabilityCommand | null {
  const continuationPid = CONTINUATION_PID_BY_COMMAND[currentCommand];
  if (!continuationPid) return null;

  return advertisedPids.includes(continuationPid)
    ? continuationPid as Mode01CapabilityCommand
    : null;
}

export function isMode01CapabilityCommand(command: string): command is Mode01CapabilityCommand {
  return MODE_01_CAPABILITY_COMMANDS.includes(command as Mode01CapabilityCommand);
}
