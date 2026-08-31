import type { DriverAlertKey } from './DriverAlertLexicon';

export type DrivingMode =
  | 'ESSENTIAL'
  | 'FAMILY'
  | 'PERFORMANCE'
  | 'OFF_ROAD'
  | 'DIAGNOSTIC';

export type SignalOrigin = 'ECU_DIRECT' | 'DEVICE_SENSOR' | 'CALCULATED' | 'ESTIMATED';

export type SignalQuality = 'VALID' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE' | 'INVALID';

export interface AvailableSignal {
  signalId: string;
  origin: SignalOrigin;
  quality: SignalQuality;
  unit?: string;
}

export type VehicleDocumentType = 'CITV' | 'SOAT' | 'GNV' | 'GLP';
export type VehicleDocumentSource = 'MANUAL_ENTRY' | 'DOCUMENT_PHOTO' | 'EXTERNAL_VERIFIED';
export type VehicleDocumentStatus = 'VALID' | 'DUE_SOON' | 'EXPIRES_IMMINENTLY' | 'EXPIRED' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface VehicleDocumentRecord {
  type: VehicleDocumentType;
  expiresAt?: string;
  source: VehicleDocumentSource;
  verifiedByUser: boolean;
  notApplicable?: boolean;
  imageReference?: string;
}

export interface DiagnosticTroubleCodeState {
  code: string;
  status: 'CONFIRMED' | 'PENDING' | 'PERMANENT';
  description?: string;
  ecu?: string;
}

export interface VehicleHealthState {
  mil: 'ON' | 'OFF' | 'UNKNOWN';
  dtcs: DiagnosticTroubleCodeState[];
  readiness?: Record<string, 'COMPLETE' | 'INCOMPLETE' | 'UNSUPPORTED' | 'UNKNOWN'>;
  freezeFrameAvailable: boolean;
}

export type DriverAdvisorySeverity = 'INFO' | 'NOTICE' | 'WARNING' | 'CRITICAL';
export type DriverAdvisoryConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AdvisoryEvidence {
  kind: 'SIGNAL' | 'DTC' | 'DOCUMENT' | 'SYSTEM';
  reference: string;
  observedValue?: number | string | boolean;
  origin?: SignalOrigin;
  quality?: SignalQuality;
}

export interface DriverAdvisory {
  id: string;
  severity: DriverAdvisorySeverity;
  title: string;
  shortMessage: string;
  voiceMessage?: string;
  voiceKey?: DriverAlertKey;
  confidence: DriverAdvisoryConfidence;
  evidence: AdvisoryEvidence[];
  startedAt: number;
  endedAt?: number;
  cooldownMs: number;
}

export interface StartupBriefing {
  headline: string;
  voiceMessage: string;
  advisories: DriverAdvisory[];
}
