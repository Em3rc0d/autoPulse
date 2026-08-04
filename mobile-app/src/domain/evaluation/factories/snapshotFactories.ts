import { ReportManifest } from '../models/reportManifest';
import { ReportVersion } from '../models/reportVersion';
import { VehicleSnapshot } from '../models/vehicleSnapshot';
import { EvidenceItem } from '../models/evidenceItem';
import { CapabilitySnapshot } from '../../acquisition/models/capabilitySnapshot';
import { deepClone, deepFreeze } from '../../shared/immutability';

export function createFrozenReportManifest(input: ReportManifest): ReportManifest {
  return deepFreeze(deepClone(input));
}

export function createFrozenReportVersion(input: ReportVersion): ReportVersion {
  return deepFreeze(deepClone(input));
}

export function createFrozenVehicleSnapshot(input: VehicleSnapshot): VehicleSnapshot {
  return deepFreeze(deepClone(input));
}

export function createFrozenCapabilitySnapshot(input: CapabilitySnapshot): CapabilitySnapshot {
  return deepFreeze(deepClone(input));
}

export function createFrozenEvidenceItem(input: EvidenceItem): EvidenceItem {
  return deepFreeze(deepClone(input));
}
