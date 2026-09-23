export type LiveDecodedSignalId =
  | 'ENGINE_RPM'
  | 'VEHICLE_SPEED'
  | 'ENGINE_COOLANT'
  | 'ENGINE_LOAD'
  | 'THROTTLE_POSITION'
  | 'CONTROL_VOLTAGE'
  | 'ADAPTER_VOLTAGE';

export interface RawDecodedValue {
  type: string;
  value: unknown;
  unit?: string;
}

export interface RoutedLiveReading {
  signalId: LiveDecodedSignalId;
  value: number;
  unit?: string;
}

const TYPE_TO_SIGNAL: Readonly<Record<string, LiveDecodedSignalId>> = Object.freeze({
  RPM: 'ENGINE_RPM',
  SPEED: 'VEHICLE_SPEED',
  COOLANT: 'ENGINE_COOLANT',
  ENGINE_LOAD: 'ENGINE_LOAD',
  THROTTLE_POSITION: 'THROTTLE_POSITION',
  ECU_VOLTAGE: 'CONTROL_VOLTAGE',
  ADAPTER_VOLTAGE: 'ADAPTER_VOLTAGE',
});

/**
 * Converts decoder output into the bounded set of live signals consumed by the
 * driver presentation. Unknown or non-numeric decoder values are ignored,
 * never coerced into another signal.
 */
export function routeLiveDecodedValues(
  decodedValues: readonly RawDecodedValue[] | null | undefined,
): RoutedLiveReading[] {
  if (!decodedValues?.length) return [];

  const routed: RoutedLiveReading[] = [];
  for (const decoded of decodedValues) {
    const signalId = TYPE_TO_SIGNAL[String(decoded.type).toUpperCase()];
    if (!signalId || typeof decoded.value !== 'number' || !Number.isFinite(decoded.value)) continue;
    routed.push({ signalId, value: decoded.value, unit: decoded.unit });
  }
  return routed;
}

/**
 * Initial ATRV evidence comes from adapter probing and can be strings such as
 * "12.4V". Only a finite positive voltage proves that periodic ATRV polling is
 * worth enabling for the live session.
 */
export function parseInitialAdapterVoltage(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (value === null || value === undefined) return null;

  const match = String(value).match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
