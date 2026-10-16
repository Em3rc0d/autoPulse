import type { VehicleCheckSignalObservation } from './VehicleCheckReport';

export type VehicleCheckEvidenceSemantic =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NOT_OBSERVED'
  | 'ERROR';

export interface VehicleCheckEvidencePresentation {
  semantic: VehicleCheckEvidenceSemantic;
  label: string;
  detail: string;
}

/**
 * Check is historical evidence, not a current-signal freshness surface.
 * Therefore STALE is intentionally not inferred here. A signal that was valid
 * during the persisted session remains OBSERVED evidence even after the session ends.
 */
export function vehicleCheckEvidencePresentation(
  observation: Pick<VehicleCheckSignalObservation, 'state'>,
): VehicleCheckEvidencePresentation {
  switch (observation.state) {
    case 'OBSERVED':
      return {
        semantic: 'AVAILABLE',
        label: 'OBSERVED',
        detail: 'Valid persisted evidence exists for this session.',
      };
    case 'PROBED_NO_DATA':
      return {
        semantic: 'UNAVAILABLE',
        label: 'UNAVAILABLE',
        detail: 'AutoPulse queried this signal, but the vehicle returned no usable data.',
      };
    case 'INVALID_ONLY':
      return {
        semantic: 'ERROR',
        label: 'INVALID',
        detail: 'The session contains attempts, but no valid reading could be accepted.',
      };
    case 'NOT_EVALUATED':
    default:
      return {
        semantic: 'NOT_OBSERVED',
        label: 'NOT OBSERVED',
        detail: 'This session does not contain enough evidence to claim support or failure.',
      };
  }
}
