import type { Mode01DirectObservationResult } from '../parsers/Mode01DirectObservationParser';
import { findPidWalletEntry } from './PidWallet';

export interface DecodedPidSignal {
  readonly key: string;
  readonly label: string;
  readonly value: number | string | boolean;
  readonly unit?: string;
}

export interface DecodedPidObservation {
  readonly pid: string;
  readonly requestId: string;
  readonly name: string;
  readonly sourceEndpointId: string | null;
  readonly signals: readonly DecodedPidSignal[];
  readonly observedAt: number;
  readonly provenance: string;
}

const percent = (byte: number): number => Math.round((byte * 10000) / 255) / 100;
const trim = (byte: number): number => Math.round((((byte - 128) * 100) / 128) * 100) / 100;

export function decodePromotedMode01Observation(
  result: Mode01DirectObservationResult,
): DecodedPidObservation | undefined {
  if (result.outcome !== 'OBSERVED_DIRECTLY') return undefined;
  const pid = result.requestPid.toUpperCase();
  const bytes = result.dataBytes;
  const wallet = findPidWalletEntry(pid);
  let signals: readonly DecodedPidSignal[] | undefined;

  switch (pid) {
    case '04':
      if (bytes.length >= 1) signals = [{ key: 'load', label: 'Calculated load', value: percent(bytes[0]), unit: '%' }];
      break;
    case '05':
      if (bytes.length >= 1) signals = [{ key: 'coolant', label: 'Coolant', value: bytes[0] - 40, unit: '°C' }];
      break;
    case '06':
      if (bytes.length >= 1) signals = [{ key: 'stft_b1', label: 'STFT Bank 1', value: trim(bytes[0]), unit: '%' }];
      break;
    case '07':
      if (bytes.length >= 1) signals = [{ key: 'ltft_b1', label: 'LTFT Bank 1', value: trim(bytes[0]), unit: '%' }];
      break;
    case '0B':
      if (bytes.length >= 1) signals = [{ key: 'map', label: 'MAP', value: bytes[0], unit: 'kPa' }];
      break;
    case '0C':
      if (bytes.length >= 2) signals = [{ key: 'rpm', label: 'Engine RPM', value: ((bytes[0] * 256) + bytes[1]) / 4, unit: 'rpm' }];
      break;
    case '0D':
      if (bytes.length >= 1) signals = [{ key: 'speed', label: 'Vehicle speed', value: bytes[0], unit: 'km/h' }];
      break;
    case '0E':
      if (bytes.length >= 1) signals = [{ key: 'timing', label: 'Timing advance', value: (bytes[0] / 2) - 64, unit: '°' }];
      break;
    case '0F':
      if (bytes.length >= 1) signals = [{ key: 'iat', label: 'Intake air temperature', value: bytes[0] - 40, unit: '°C' }];
      break;
    case '11':
      if (bytes.length >= 1) signals = [{ key: 'throttle', label: 'Throttle position', value: percent(bytes[0]), unit: '%' }];
      break;
    case '14':
    case '15':
      if (bytes.length >= 2) signals = [
        { key: `o2_${pid}_voltage`, label: `O2 PID ${pid} voltage`, value: Math.round((bytes[0] / 200) * 1000) / 1000, unit: 'V' },
        { key: `o2_${pid}_trim`, label: `O2 PID ${pid} trim`, value: trim(bytes[1]), unit: '%' },
      ];
      break;
  }

  if (!signals) return undefined;
  return Object.freeze({
    pid,
    requestId: `01${pid}`,
    name: wallet?.canonicalName ?? `Mode 01 PID ${pid}`,
    sourceEndpointId: result.sourceEndpointId,
    signals: Object.freeze(signals.map(signal => Object.freeze(signal))),
    observedAt: result.observedAt,
    provenance: `${result.provenance}; CHECK v4 promoted deterministic decoder`,
  });
}

export function formatDecodedPidObservation(observation: DecodedPidObservation): string {
  return observation.signals
    .map(signal => `${signal.label}: ${String(signal.value)}${signal.unit ? ` ${signal.unit}` : ''}`)
    .join(' · ');
}
