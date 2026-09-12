export type DiagnosticEvidenceFamily =
  | 'READINESS'
  | 'COMBUSTION'
  | 'AIR_FUEL'
  | 'CATALYST'
  | 'COOLING'
  | 'O2_SENSOR'
  | 'ELECTRICAL'
  | 'AIR_METERING'
  | 'FUEL_DELIVERY'
  | 'EGR'
  | 'EVAP'
  | 'TRANSMISSION'
  | 'CONTEXT';

export type PidPromotionStatus =
  | 'REFERENCE_DEFINED'
  | 'DECODER_IMPLEMENTED'
  | 'DECODER_TESTED'
  | 'SAFE_READ_ONLY'
  | 'REPLAY_VALIDATED'
  | 'PHYSICALLY_OBSERVED';

export interface PidWalletEntry {
  readonly service: '01';
  readonly pid: string;
  readonly requestId: string;
  readonly canonicalName: string;
  readonly unit?: string;
  readonly evidenceFamilies: readonly DiagnosticEvidenceFamily[];
  readonly referenceSource: 'Q-OBD2-PID-CATALOG-20260904';
  readonly promotionStatus: PidPromotionStatus;
  readonly executableInCheckV4: boolean;
}

/**
 * Exact 114-PID reference inventory mined in Q-OBD2-PID-CATALOG-20260904.
 * Presence here is catalog knowledge only; it never means a vehicle supports
 * the PID and never authorizes a request by itself.
 */
export const MODE01_REFERENCE_PID_HEX = Object.freeze([
  '00','01','02','03','04','05','06','07','08','09','0A','0B','0C','0D','0E','0F','10','11','12','14','15','16','17','18','19','1A','1B','1C','1F','20','21','22','23','24','25','26','27','28','29','2A','2B','2C','2D','2E','2F','30','31','32','33','34','35','36','37','38','39','3A','3B','3C','3D','3E','3F','40','41','42','43','44','45','46','47','48','49','4A','4B','4C','4D','4E','4F','50','51','52','53','54','55','56','57','58','59','5A','5B','5C','5D','5E','5F','60','61','62','63','65','66','67','68','69','6A','6B','6C','6D','6E','6F','70','80','8E','A0','A6','C0',
] as const);

const details: Readonly<Record<string, { name: string; unit?: string; families: readonly DiagnosticEvidenceFamily[]; executable?: boolean; observed?: boolean }>> = Object.freeze({
  '01': { name: 'Monitor status since DTCs cleared', families: ['READINESS'], executable: true },
  '04': { name: 'Calculated engine load', unit: '%', families: ['COMBUSTION','CONTEXT'], executable: true },
  '05': { name: 'Engine coolant temperature', unit: '°C', families: ['COOLING','COMBUSTION','CONTEXT'], executable: true, observed: true },
  '06': { name: 'Short-term fuel trim Bank 1', unit: '%', families: ['AIR_FUEL','FUEL_DELIVERY'], executable: true },
  '07': { name: 'Long-term fuel trim Bank 1', unit: '%', families: ['AIR_FUEL','FUEL_DELIVERY'], executable: true },
  '08': { name: 'Short-term fuel trim Bank 2', unit: '%', families: ['AIR_FUEL','FUEL_DELIVERY'] },
  '09': { name: 'Long-term fuel trim Bank 2', unit: '%', families: ['AIR_FUEL','FUEL_DELIVERY'] },
  '0A': { name: 'Fuel pressure', unit: 'kPa', families: ['FUEL_DELIVERY'] },
  '0B': { name: 'Intake manifold absolute pressure', unit: 'kPa', families: ['AIR_METERING','COMBUSTION'], executable: true },
  '0C': { name: 'Engine RPM', unit: 'rpm', families: ['COMBUSTION','CONTEXT'], executable: true, observed: true },
  '0D': { name: 'Vehicle speed', unit: 'km/h', families: ['CONTEXT'], executable: true, observed: true },
  '0E': { name: 'Timing advance', unit: '°', families: ['COMBUSTION'], executable: true },
  '0F': { name: 'Intake air temperature', unit: '°C', families: ['AIR_METERING','CONTEXT'], executable: true },
  '10': { name: 'MAF air flow rate', unit: 'g/s', families: ['AIR_METERING','AIR_FUEL'] },
  '11': { name: 'Throttle position', unit: '%', families: ['AIR_METERING','CONTEXT'], executable: true },
  '13': { name: 'Oxygen sensors present', families: ['O2_SENSOR','CATALYST'] },
  '14': { name: 'Oxygen sensor 1 voltage / STFT', families: ['O2_SENSOR','AIR_FUEL','CATALYST'], executable: true },
  '15': { name: 'Oxygen sensor 2 voltage / STFT', families: ['O2_SENSOR','AIR_FUEL','CATALYST'], executable: true },
  '1C': { name: 'OBD standards supported', families: ['CONTEXT'] },
  '1F': { name: 'Run time since engine start', unit: 's', families: ['CONTEXT'] },
  '21': { name: 'Distance traveled with MIL on', unit: 'km', families: ['READINESS','CONTEXT'] },
  '30': { name: 'Warm-ups since codes cleared', families: ['READINESS','CONTEXT'] },
  '31': { name: 'Distance since codes cleared', unit: 'km', families: ['READINESS','CONTEXT'] },
  '3C': { name: 'Catalyst temperature Bank 1 Sensor 1', unit: '°C', families: ['CATALYST'] },
  '3D': { name: 'Catalyst temperature Bank 2 Sensor 1', unit: '°C', families: ['CATALYST'] },
  '3E': { name: 'Catalyst temperature Bank 1 Sensor 2', unit: '°C', families: ['CATALYST'] },
  '3F': { name: 'Catalyst temperature Bank 2 Sensor 2', unit: '°C', families: ['CATALYST'] },
  '41': { name: 'Monitor status this drive cycle', families: ['READINESS'] },
  '42': { name: 'Control module voltage', unit: 'V', families: ['ELECTRICAL','CONTEXT'] },
  '4D': { name: 'Time run with MIL on', unit: 'min', families: ['READINESS','CONTEXT'] },
  '4E': { name: 'Time since trouble codes cleared', unit: 'min', families: ['READINESS','CONTEXT'] },
  '51': { name: 'Fuel type', families: ['FUEL_DELIVERY','CONTEXT'] },
  '5C': { name: 'Engine oil temperature', unit: '°C', families: ['COOLING','CONTEXT'] },
  '5D': { name: 'Fuel injection timing', unit: '°', families: ['FUEL_DELIVERY','COMBUSTION'] },
  '5E': { name: 'Engine fuel rate', unit: 'L/h', families: ['FUEL_DELIVERY'] },
  '61': { name: 'Driver demand engine torque', unit: '%', families: ['COMBUSTION','CONTEXT'] },
  '62': { name: 'Actual engine torque', unit: '%', families: ['COMBUSTION','CONTEXT'] },
  '63': { name: 'Engine reference torque', unit: 'Nm', families: ['COMBUSTION','CONTEXT'] },
  'A6': { name: 'Odometer', unit: 'km', families: ['CONTEXT'] },
});

const SUPPORT_BITMAPS = new Set(['00','20','40','60','80','A0','C0']);

export const CHECK_V4_PID_WALLET: readonly PidWalletEntry[] = Object.freeze(
  MODE01_REFERENCE_PID_HEX.map(pid => {
    const detail = details[pid];
    const executable = Boolean(detail?.executable);
    const promotionStatus: PidPromotionStatus = detail?.observed
      ? 'PHYSICALLY_OBSERVED'
      : executable
        ? 'SAFE_READ_ONLY'
        : 'REFERENCE_DEFINED';
    return Object.freeze({
      service: '01' as const,
      pid,
      requestId: `01${pid}`,
      canonicalName: detail?.name ?? (SUPPORT_BITMAPS.has(pid) ? `PIDs supported bitmap ${pid}` : `Mode 01 PID ${pid}`),
      ...(detail?.unit ? { unit: detail.unit } : {}),
      evidenceFamilies: Object.freeze([...(detail?.families ?? ['CONTEXT' as const])]),
      referenceSource: 'Q-OBD2-PID-CATALOG-20260904' as const,
      promotionStatus,
      executableInCheckV4: executable,
    });
  }),
);

export function findPidWalletEntry(pid: string): PidWalletEntry | undefined {
  const normalized = pid.trim().toUpperCase().replace(/^01/, '');
  return CHECK_V4_PID_WALLET.find(entry => entry.pid === normalized);
}

export function isCheckV4ExecutablePid(pid: string): boolean {
  return Boolean(findPidWalletEntry(pid)?.executableInCheckV4);
}
