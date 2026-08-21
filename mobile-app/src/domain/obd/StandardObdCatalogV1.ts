export const STANDARD_OBD_CATALOG_VERSION = 'AUTOPULSE_STANDARD_OBD_V1';
export const STANDARD_OBD_AUTHORITY = 'SAE_J1979_MODE_01';

export interface StandardObdDefinition {
  readonly requestId: string;
  readonly pid: string;
  readonly signalType: string;
  readonly technicalName: string;
  readonly unit: string;
  readonly minimumBytes: number;
  readonly numericType: 'integer' | 'float';
  readonly precision: number;
  readonly priority: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly decoderKey: string;
  readonly authority: typeof STANDARD_OBD_AUTHORITY;
  readonly catalogVersion: typeof STANDARD_OBD_CATALOG_VERSION;
  readonly decode: (bytes: readonly number[]) => number;
}

function definition(
  input: Omit<StandardObdDefinition, 'authority' | 'catalogVersion'>
): StandardObdDefinition {
  return Object.freeze({
    ...input,
    authority: STANDARD_OBD_AUTHORITY,
    catalogVersion: STANDARD_OBD_CATALOG_VERSION
  });
}

export const STANDARD_OBD_TIER_1: readonly StandardObdDefinition[] = Object.freeze([
  definition({
    requestId: '0104', pid: '04', signalType: 'ENGINE_LOAD',
    technicalName: 'Calculated engine load', unit: '%', minimumBytes: 1,
    numericType: 'float', precision: 1, priority: 'MEDIUM',
    decoderKey: 'MODE01_0104', decode: ([a]) => a * 100 / 255
  }),
  definition({
    requestId: '0105', pid: '05', signalType: 'COOLANT',
    technicalName: 'Engine coolant temperature', unit: '°C', minimumBytes: 1,
    numericType: 'float', precision: 1, priority: 'MEDIUM',
    decoderKey: 'MODE01_0105', decode: ([a]) => a - 40
  }),
  definition({
    requestId: '010B', pid: '0B', signalType: 'MAP',
    technicalName: 'Intake manifold absolute pressure', unit: 'kPa', minimumBytes: 1,
    numericType: 'integer', precision: 0, priority: 'MEDIUM',
    decoderKey: 'MODE01_010B', decode: ([a]) => a
  }),
  definition({
    requestId: '010C', pid: '0C', signalType: 'RPM',
    technicalName: 'Engine speed', unit: 'RPM', minimumBytes: 2,
    numericType: 'float', precision: 0, priority: 'HIGH',
    decoderKey: 'MODE01_010C', decode: ([a, b]) => ((a * 256) + b) / 4
  }),
  definition({
    requestId: '010D', pid: '0D', signalType: 'SPEED',
    technicalName: 'Vehicle speed', unit: 'km/h', minimumBytes: 1,
    numericType: 'integer', precision: 0, priority: 'HIGH',
    decoderKey: 'MODE01_010D', decode: ([a]) => a
  }),
  definition({
    requestId: '010F', pid: '0F', signalType: 'INTAKE_AIR_TEMPERATURE',
    technicalName: 'Intake air temperature', unit: '°C', minimumBytes: 1,
    numericType: 'float', precision: 1, priority: 'MEDIUM',
    decoderKey: 'MODE01_010F', decode: ([a]) => a - 40
  }),
  definition({
    requestId: '0110', pid: '10', signalType: 'MAF',
    technicalName: 'Mass air flow rate', unit: 'g/s', minimumBytes: 2,
    numericType: 'float', precision: 2, priority: 'MEDIUM',
    decoderKey: 'MODE01_0110', decode: ([a, b]) => ((a * 256) + b) / 100
  }),
  definition({
    requestId: '0111', pid: '11', signalType: 'THROTTLE_POSITION',
    technicalName: 'Absolute throttle position', unit: '%', minimumBytes: 1,
    numericType: 'float', precision: 1, priority: 'MEDIUM',
    decoderKey: 'MODE01_0111', decode: ([a]) => a * 100 / 255
  }),
  definition({
    requestId: '011F', pid: '1F', signalType: 'ENGINE_RUNTIME',
    technicalName: 'Run time since engine start', unit: 's', minimumBytes: 2,
    numericType: 'integer', precision: 0, priority: 'LOW',
    decoderKey: 'MODE01_011F', decode: ([a, b]) => (a * 256) + b
  }),
  definition({
    requestId: '0142', pid: '42', signalType: 'ECU_VOLTAGE',
    technicalName: 'Control module voltage', unit: 'V', minimumBytes: 2,
    numericType: 'float', precision: 3, priority: 'LOW',
    decoderKey: 'MODE01_0142', decode: ([a, b]) => ((a * 256) + b) / 1000
  })
]);

const TIER_1_BY_PID = new Map(
  STANDARD_OBD_TIER_1.map(item => [item.pid, item] as const)
);

export function getStandardObdDefinition(pid: string): StandardObdDefinition | null {
  return TIER_1_BY_PID.get(pid.toUpperCase()) ?? null;
}

export function decodeStandardObdPid(
  pid: string,
  bytes: readonly number[]
): { type: string; value: number; unit: string } | null {
  const item = getStandardObdDefinition(pid);
  if (!item || bytes.length < item.minimumBytes) return null;

  const required = bytes.slice(0, item.minimumBytes);
  if (required.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return null;
  }

  const value = item.decode(required);
  return Number.isFinite(value)
    ? { type: item.signalType, value, unit: item.unit }
    : null;
}
