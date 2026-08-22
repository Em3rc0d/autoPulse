import type { AvailableSignal, SignalQuality } from '../../../domain/driver-intelligence';

const PID_TO_SIGNAL: Record<string, string> = {
  '0104': 'ENGINE_LOAD',
  '0105': 'ENGINE_COOLANT',
  '0106': 'STFT_B1',
  '0107': 'LTFT_B1',
  '010B': 'MAP',
  '010C': 'ENGINE_RPM',
  '010D': 'VEHICLE_SPEED',
  '010F': 'INTAKE_AIR_TEMP',
  '0110': 'MAF',
  '0111': 'THROTTLE_POSITION',
  '012F': 'FUEL_LEVEL',
  '0142': 'CONTROL_VOLTAGE',
  '015C': 'OIL_TEMP',
  '0162': 'ACTUAL_ENGINE_TORQUE',
  'ATRV': 'ADAPTER_VOLTAGE',
};

export interface LiveSignalQualityInput {
  signalId: string;
  quality: SignalQuality;
}

export function buildLiveSignalInventory(
  supportedPids: readonly string[] = [],
  observedQualities: readonly LiveSignalQualityInput[] = [],
): AvailableSignal[] {
  const qualityBySignal = new Map(observedQualities.map(item => [item.signalId, item.quality]));
  const inventory = new Map<string, AvailableSignal>();

  for (const pid of supportedPids) {
    const normalizedPid = String(pid).toUpperCase();
    const signalId = PID_TO_SIGNAL[normalizedPid];
    if (!signalId) continue;

    inventory.set(signalId, {
      signalId,
      origin: signalId === 'ADAPTER_VOLTAGE' ? 'DEVICE_SENSOR' : 'ECU_DIRECT',
      quality: qualityBySignal.get(signalId) ?? 'DEGRADED',
    });
  }

  // ATRV is adapter-origin and may be collected independently of the ECU PID bitmap.
  if (qualityBySignal.has('ADAPTER_VOLTAGE') && !inventory.has('ADAPTER_VOLTAGE')) {
    inventory.set('ADAPTER_VOLTAGE', {
      signalId: 'ADAPTER_VOLTAGE',
      origin: 'DEVICE_SENSOR',
      quality: qualityBySignal.get('ADAPTER_VOLTAGE')!,
      unit: 'V',
    });
  }

  // A successful observation is stronger evidence than the initial supported-PID list.
  for (const item of observedQualities) {
    if (item.quality === 'UNAVAILABLE' || item.quality === 'INVALID') continue;
    const existing = inventory.get(item.signalId);
    inventory.set(item.signalId, {
      signalId: item.signalId,
      origin: existing?.origin ?? (item.signalId === 'ADAPTER_VOLTAGE' ? 'DEVICE_SENSOR' : 'ECU_DIRECT'),
      quality: item.quality,
      unit: existing?.unit,
    });
  }

  return Array.from(inventory.values());
}

export function signalIdForPid(pid: string): string | undefined {
  return PID_TO_SIGNAL[String(pid).toUpperCase()];
}
