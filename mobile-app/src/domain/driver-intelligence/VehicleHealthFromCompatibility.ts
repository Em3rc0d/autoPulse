import type { CompatibilitySnapshot, DiagnosticServiceFamily } from '../diagnostics';
import type { DiagnosticTroubleCodeState, VehicleHealthState } from './models';

const STATUS_BY_FAMILY: Partial<Record<DiagnosticServiceFamily, DiagnosticTroubleCodeState['status']>> = {
  STORED_DTC: 'CONFIRMED',
  PENDING_DTC: 'PENDING',
  PERMANENT_DTC: 'PERMANENT',
};

export function describeStandardDtc(code: string): string | undefined {
  const normalized = code.toUpperCase();
  if (normalized === 'P0300') return 'Random or multiple cylinder misfire detected';
  const cylinderMisfire = normalized.match(/^P030([1-9A-F])$/);
  if (cylinderMisfire) {
    const cylinder = parseInt(cylinderMisfire[1], 16);
    return `Cylinder ${cylinder} misfire detected`;
  }
  return undefined;
}

/**
 * Converts only directly observed standard diagnostic-code evidence into the
 * Driver Intelligence health model. Missing MIL/readiness/freeze-frame data is
 * preserved as unknown and therefore remains absent from driver UI.
 */
export function vehicleHealthFromCompatibility(snapshot: CompatibilitySnapshot): VehicleHealthState {
  const dtcs: DiagnosticTroubleCodeState[] = [];
  const seen = new Set<string>();

  for (const service of snapshot.diagnosticServices) {
    const status = STATUS_BY_FAMILY[service.family];
    if (!status || !service.observed) continue;

    for (const code of service.diagnosticCodes ?? []) {
      const normalized = code.toUpperCase();
      const key = `${status}:${normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dtcs.push({
        code: normalized,
        status,
        description: describeStandardDtc(normalized),
        ecu: service.sourceEcus.length === 1 ? service.sourceEcus[0] : undefined,
      });
    }
  }

  return {
    mil: 'UNKNOWN',
    dtcs,
    freezeFrameAvailable: false,
  };
}
