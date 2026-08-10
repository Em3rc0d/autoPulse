export type ObdSignalSource = 'ECU_DIRECT' | 'ADAPTER_LOCAL' | 'CALCULATED';

export interface ObdSignalDefinition {
  canonicalId: string;
  command: string | null;
  unit: string;
  source: ObdSignalSource;
  isDecodable: boolean;
}

export const OBD_SIGNAL_REGISTRY: Record<string, ObdSignalDefinition> = {
  ENGINE_RPM: {
    canonicalId: 'ENGINE_RPM',
    command: '010C',
    unit: 'RPM',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  VEHICLE_SPEED: {
    canonicalId: 'VEHICLE_SPEED',
    command: '010D',
    unit: 'km/h',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  ENGINE_COOLANT: {
    canonicalId: 'ENGINE_COOLANT',
    command: '0105',
    unit: '°C',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  CONTROL_MODULE_VOLTAGE: {
    canonicalId: 'CONTROL_MODULE_VOLTAGE',
    command: '0142',
    unit: 'V',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  ADAPTER_VOLTAGE: {
    canonicalId: 'ADAPTER_VOLTAGE',
    command: 'ATRV',
    unit: 'V',
    source: 'ADAPTER_LOCAL',
    isDecodable: true,
  },
  ENGINE_LOAD: {
    canonicalId: 'ENGINE_LOAD',
    command: '0104',
    unit: '%',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  MAP: {
    canonicalId: 'MAP',
    command: '010B',
    unit: 'kPa',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  TIMING_ADVANCE: {
    canonicalId: 'TIMING_ADVANCE',
    command: '010E',
    unit: 'deg',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  INTAKE_TEMP: {
    canonicalId: 'INTAKE_TEMP',
    command: '010F',
    unit: '°C',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  MAF: {
    canonicalId: 'MAF',
    command: '0110',
    unit: 'g/s',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  THROTTLE_POSITION: {
    canonicalId: 'THROTTLE_POSITION',
    command: '0111',
    unit: '%',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  FUEL_LEVEL: {
    canonicalId: 'FUEL_LEVEL',
    command: '012F',
    unit: '%',
    source: 'ECU_DIRECT',
    isDecodable: true,
  },
  ENGINE_OIL_TEMP: {
    canonicalId: 'ENGINE_OIL_TEMP',
    command: '015C',
    unit: '°C',
    source: 'ECU_DIRECT',
    isDecodable: true,
  }
};

export function isProductSignalSupported(signalId: string): boolean {
  return OBD_SIGNAL_REGISTRY[signalId]?.isDecodable === true;
}
