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

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const percent = (byte: number): number => round((byte * 100) / 255);
const trim = (byte: number): number => round(((byte - 128) * 100) / 128);
const u16 = (bytes: readonly number[]): number => (bytes[0] * 256) + bytes[1];

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
    case '0A':
      if (bytes.length >= 1) signals = [{ key: 'fuel_pressure', label: 'Fuel pressure', value: bytes[0] * 3, unit: 'kPa' }];
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
    case '10':
      if (bytes.length >= 2) signals = [{ key: 'maf', label: 'MAF', value: round(u16(bytes) / 100), unit: 'g/s' }];
      break;
    case '11':
      if (bytes.length >= 1) signals = [{ key: 'throttle', label: 'Throttle position', value: percent(bytes[0]), unit: '%' }];
      break;
    case '14':
    case '15':
      if (bytes.length >= 2) signals = [
        { key: `o2_${pid}_voltage`, label: `O2 PID ${pid} voltage`, value: round(bytes[0] / 200, 3), unit: 'V' },
        { key: `o2_${pid}_trim`, label: `O2 PID ${pid} trim`, value: trim(bytes[1]), unit: '%' },
      ];
      break;
    case '1F':
      if (bytes.length >= 2) signals = [{ key: 'engine_runtime', label: 'Engine run time', value: u16(bytes), unit: 's' }];
      break;
    case '21':
      if (bytes.length >= 2) signals = [{ key: 'distance_mil', label: 'Distance with MIL on', value: u16(bytes), unit: 'km' }];
      break;
    case '2F':
      if (bytes.length >= 1) signals = [{ key: 'fuel_level', label: 'Fuel level', value: percent(bytes[0]), unit: '%' }];
      break;
    case '30':
      if (bytes.length >= 1) signals = [{ key: 'warmups_since_clear', label: 'Warm-ups since codes cleared', value: bytes[0] }];
      break;
    case '31':
      if (bytes.length >= 2) signals = [{ key: 'distance_since_clear', label: 'Distance since codes cleared', value: u16(bytes), unit: 'km' }];
      break;
    case '33':
      if (bytes.length >= 1) signals = [{ key: 'barometric_pressure', label: 'Barometric pressure', value: bytes[0], unit: 'kPa' }];
      break;
    case '3C':
    case '3D':
    case '3E':
    case '3F':
      if (bytes.length >= 2) signals = [{
        key: `catalyst_temp_${pid.toLowerCase()}`,
        label: wallet?.canonicalName ?? `Catalyst temperature PID ${pid}`,
        value: round((u16(bytes) / 10) - 40, 1),
        unit: '°C',
      }];
      break;
    case '42':
      if (bytes.length >= 2) signals = [{ key: 'control_voltage', label: 'Control module voltage', value: round(u16(bytes) / 1000, 3), unit: 'V' }];
      break;
    case '45':
      if (bytes.length >= 1) signals = [{ key: 'relative_throttle', label: 'Relative throttle position', value: percent(bytes[0]), unit: '%' }];
      break;
    case '46':
      if (bytes.length >= 1) signals = [{ key: 'ambient_temp', label: 'Ambient air temperature', value: bytes[0] - 40, unit: '°C' }];
      break;
    case '4D':
      if (bytes.length >= 2) signals = [{ key: 'time_mil', label: 'Time with MIL on', value: u16(bytes), unit: 'min' }];
      break;
    case '4E':
      if (bytes.length >= 2) signals = [{ key: 'time_since_clear', label: 'Time since codes cleared', value: u16(bytes), unit: 'min' }];
      break;
    case '5C':
      if (bytes.length >= 1) signals = [{ key: 'oil_temp', label: 'Engine oil temperature', value: bytes[0] - 40, unit: '°C' }];
      break;
    case '5D':
      if (bytes.length >= 2) signals = [{ key: 'injection_timing', label: 'Fuel injection timing', value: round((u16(bytes) / 128) - 210, 2), unit: '°' }];
      break;
    case '5E':
      if (bytes.length >= 2) signals = [{ key: 'fuel_rate', label: 'Engine fuel rate', value: round(u16(bytes) / 20, 2), unit: 'L/h' }];
      break;
    case '61':
      if (bytes.length >= 1) signals = [{ key: 'driver_torque_demand', label: 'Driver demand engine torque', value: bytes[0] - 125, unit: '%' }];
      break;
    case '62':
      if (bytes.length >= 1) signals = [{ key: 'actual_torque', label: 'Actual engine torque', value: bytes[0] - 125, unit: '%' }];
      break;
    case '63':
      if (bytes.length >= 2) signals = [{ key: 'reference_torque', label: 'Engine reference torque', value: u16(bytes), unit: 'Nm' }];
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
    provenance: `${result.provenance}; CHECK v5 promoted deterministic decoder`,
  });
}

export function formatDecodedPidObservation(observation: DecodedPidObservation): string {
  return observation.signals
    .map(signal => `${signal.label}: ${String(signal.value)}${signal.unit ? ` ${signal.unit}` : ''}`)
    .join(' · ');
}
