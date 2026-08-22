import type { VehicleDocumentRecord, VehicleDocumentStatus } from './models';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VehicleDocumentAssessment {
  record: VehicleDocumentRecord;
  status: VehicleDocumentStatus;
  daysRemaining: number | null;
}

export function assessVehicleDocument(
  record: VehicleDocumentRecord,
  nowMs: number,
): VehicleDocumentAssessment {
  if (record.notApplicable) {
    return { record, status: 'NOT_APPLICABLE', daysRemaining: null };
  }

  if (!record.expiresAt) {
    return { record, status: 'UNKNOWN', daysRemaining: null };
  }

  const expiryMs = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return { record, status: 'UNKNOWN', daysRemaining: null };
  }

  const daysRemaining = Math.ceil((expiryMs - nowMs) / DAY_MS);

  if (daysRemaining < 0) {
    return { record, status: 'EXPIRED', daysRemaining };
  }
  if (daysRemaining <= 7) {
    return { record, status: 'EXPIRES_IMMINENTLY', daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { record, status: 'DUE_SOON', daysRemaining };
  }

  return { record, status: 'VALID', daysRemaining };
}
