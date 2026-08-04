export type SignalAdvisorySource =
  | 'ECU'
  | 'OEM_MANUAL'
  | 'VEHICLE_PROFILE'
  | 'ENGINE_FAMILY_PROFILE'
  | 'GENERIC_REFERENCE';

export type SignalCalibrationStatus =
  | 'OEM_CALIBRATED'
  | 'VEHICLE_CALIBRATED'
  | 'GENERIC_ONLY'
  | 'NOT_CALIBRATED';

export type DataQuality =
  | 'VALID'
  | 'DEGRADED'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'INVALID'
  | 'SUSPECT';

export type SignalAdvisoryStatus =
  | 'COLD'
  | 'WARMING'
  | 'NORMAL'
  | 'ELEVATED'
  | 'CRITICAL'
  | 'UNKNOWN';

export interface SignalAdvisoryBand {
  min?: number;
  max?: number;
  status: SignalAdvisoryStatus;
}

export interface SignalReferenceRange {
  context:
    | 'GENERAL'
    | 'IDLE'
    | 'COLD_START'
    | 'NORMAL_DRIVING'
    | 'GASOLINE_ENGINE'
    | 'ENGINE_OFF'
    | 'ENGINE_RUNNING';
  label: string;
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit: string;
  displayOrder: number;
}

export interface SignalAdvisoryProfile {
  vehicleId: string;
  signalId: 'ENGINE_RPM' | 'ENGINE_COOLANT' | 'VEHICLE_SPEED' | 'CONTROL_VOLTAGE' | string;
  pid?: string;
  service?: string;
  sourceType: SignalAdvisorySource;
  calibrationStatus: SignalCalibrationStatus;
  sourceReference?: string;
  bands: SignalAdvisoryBand[];
  referenceRanges?: SignalReferenceRange[];
  hysteresisMs: number;
  sustainDurationMs: number;
}

export interface SignalAdvisoryState {
  quality: DataQuality;
  advisory: SignalAdvisoryStatus;
  calibration: SignalCalibrationStatus;
  source: SignalAdvisorySource;
  color: 'GRAY' | 'BLUE' | 'GREEN' | 'ORANGE' | 'RED' | 'NEUTRAL';
  badgeText: string;
}

export interface SignalSessionStats {
  validReadingCount: number;
  validMinObserved: number | null;
  validMaxObserved: number | null;
  engineStoppedObserved?: boolean; // Specific to RPM
  suspectValuesObserved?: boolean; // Specific to Coolant Protocol Floor
}

export interface AdvisoryContextValue {
  value: number | null;
  quality: DataQuality;
  observedAt: number | null;
}

export interface AdvisoryContext {
  speed?: AdvisoryContextValue;
  rpm?: AdvisoryContextValue;
}
