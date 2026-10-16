import {
  getNextCapabilityCommand,
  Mode01CapabilityCommand,
} from '../../../domain/acquisition/Mode01CapabilityDiscovery';
import { areDiagnosticBytes } from './DiagnosticServiceEnvelope';

export type PidSupportBitmapParseOutcome = 'VALID' | 'INVALID';

export interface PidSupportBitmapParseResult {
  readonly outcome: PidSupportBitmapParseOutcome;
  readonly command: Mode01CapabilityCommand;
  readonly advertisedPids: readonly string[];
  readonly continuationCommand: Mode01CapabilityCommand | null;
  readonly rawPayload: readonly number[];
  readonly limitation?: string;
}

/**
 * Decode exactly one standard 32-bit Mode 01 support bitmap.
 * The result is capability evidence only; it does not imply a PID was queried or observed.
 */
export function parsePidSupportBitmap(
  command: Mode01CapabilityCommand,
  payload: readonly number[],
): PidSupportBitmapParseResult {
  if (payload.length !== 4 || !areDiagnosticBytes(payload)) {
    return {
      outcome: 'INVALID',
      command,
      advertisedPids: [],
      continuationCommand: null,
      rawPayload: payload,
      limitation: 'Mode 01 capability bitmap must contain exactly four valid bytes',
    };
  }

  const basePid = parseInt(command.slice(2), 16);
  const advertisedPids: string[] = [];

  for (let byteIndex = 0; byteIndex < 4; byteIndex += 1) {
    const byte = payload[byteIndex];
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      if ((byte & (0x80 >> bitIndex)) === 0) continue;
      const pidNumber = basePid + 1 + (byteIndex * 8) + bitIndex;
      advertisedPids.push(`01${pidNumber.toString(16).padStart(2, '0').toUpperCase()}`);
    }
  }

  return {
    outcome: 'VALID',
    command,
    advertisedPids,
    continuationCommand: getNextCapabilityCommand(command, advertisedPids),
    rawPayload: payload,
  };
}
