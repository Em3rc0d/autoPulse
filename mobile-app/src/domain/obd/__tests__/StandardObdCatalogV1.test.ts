import {
  STANDARD_OBD_AUTHORITY,
  STANDARD_OBD_CATALOG_VERSION,
  STANDARD_OBD_TIER_1,
  decodeStandardObdPid
} from '../StandardObdCatalogV1';

describe('StandardObdCatalogV1', () => {
  it('has explicit catalog and definition authority', () => {
    expect(STANDARD_OBD_CATALOG_VERSION).toBe('AUTOPULSE_STANDARD_OBD_V1');
    expect(STANDARD_OBD_AUTHORITY).toBe('SAE_J1979_MODE_01');
    expect(STANDARD_OBD_TIER_1).toHaveLength(10);
    expect(STANDARD_OBD_TIER_1.every(item =>
      item.authority === STANDARD_OBD_AUTHORITY &&
      item.catalogVersion === STANDARD_OBD_CATALOG_VERSION
    )).toBe(true);
  });

  it.each([
    ['04', [0xFF], 'ENGINE_LOAD', 100, '%'],
    ['05', [0x00], 'COOLANT', -40, '°C'],
    ['0B', [0x64], 'MAP', 100, 'kPa'],
    ['0C', [0x1A, 0xF8], 'RPM', 1726, 'RPM'],
    ['0D', [0x58], 'SPEED', 88, 'km/h'],
    ['0F', [0x32], 'INTAKE_AIR_TEMPERATURE', 10, '°C'],
    ['10', [0x01, 0xF4], 'MAF', 5, 'g/s'],
    ['11', [0xFF], 'THROTTLE_POSITION', 100, '%'],
    ['1F', [0x0E, 0x10], 'ENGINE_RUNTIME', 3600, 's'],
    ['42', [0x30, 0x39], 'ECU_VOLTAGE', 12.345, 'V']
  ] as const)('decodes PID %s from a deterministic raw vector', (pid, bytes, type, value, unit) => {
    const decoded = decodeStandardObdPid(pid, bytes);
    expect(decoded?.type).toBe(type);
    expect(decoded?.unit).toBe(unit);
    expect(decoded?.value).toBeCloseTo(value, 6);
  });

  it('does not turn missing, invalid or unknown bytes into zero', () => {
    expect(decodeStandardObdPid('0C', [0x1A])).toBeNull();
    expect(decodeStandardObdPid('05', [-1])).toBeNull();
    expect(decodeStandardObdPid('05', [256])).toBeNull();
    expect(decodeStandardObdPid('99', [0])).toBeNull();
  });

  it('keeps ECU voltage semantically explicit', () => {
    expect(decodeStandardObdPid('42', [0x30, 0x39])).toEqual({
      type: 'ECU_VOLTAGE',
      value: 12.345,
      unit: 'V'
    });
  });
});
