import { CaptureContext, EvidenceOrigin } from '../../domain/evaluation/models/enums';

export type AutoPulseCheckPurpose =
  | 'PRE_PURCHASE'
  | 'PREVENTIVE'
  | 'WORKSHOP'
  | 'PRE_TRIP'
  | 'FLEET'
  | 'CUSTOM';

export type CapabilitySupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface AutoPulseCheckCapabilityFacts {
  readonly obd: CapabilitySupport;
  readonly dtcRead: CapabilitySupport;
  readonly readiness: CapabilitySupport;
  readonly freezeFrame: CapabilitySupport;
  readonly liveTelemetry: CapabilitySupport;
  readonly availableSignals?: readonly string[];
}

export type AutoPulseCheckStepId =
  | 'INTAKE'
  | 'VISUAL_BASELINE'
  | 'CAPABILITY_DISCOVERY'
  | 'DTC_SCAN'
  | 'READINESS_SCAN'
  | 'FREEZE_FRAME'
  | 'IDLE_TELEMETRY'
  | 'ROAD_TELEMETRY'
  | 'PROFESSIONAL_REVIEW'
  | 'REPORT_FINALIZATION';

export type AutoPulseCheckStepAvailability =
  | 'AVAILABLE'
  | 'CONDITIONAL'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export interface AutoPulseCheckPlanStep {
  readonly id: AutoPulseCheckStepId;
  readonly title: string;
  readonly order: number;
  readonly mandatory: boolean;
  readonly availability: AutoPulseCheckStepAvailability;
  readonly evidenceOrigin: EvidenceOrigin;
  readonly captureContext?: CaptureContext;
  readonly limitation?: string;
}

export interface AutoPulseCheckPlan {
  readonly purpose: AutoPulseCheckPurpose;
  readonly steps: readonly AutoPulseCheckPlanStep[];
  readonly limitations: readonly string[];
}

function availabilityOf(support: CapabilitySupport): AutoPulseCheckStepAvailability {
  if (support === 'SUPPORTED') return 'AVAILABLE';
  if (support === 'UNSUPPORTED') return 'UNAVAILABLE';
  return 'UNKNOWN';
}

function limitationFor(label: string, support: CapabilitySupport): string | undefined {
  if (support === 'UNSUPPORTED') return `${label} is not supported by the observed vehicle/adapter capability set.`;
  if (support === 'UNKNOWN') return `${label} capability has not yet been proven for this vehicle/adapter pair.`;
  return undefined;
}

export function buildAutoPulseCheckPlan(
  purpose: AutoPulseCheckPurpose,
  capabilities: AutoPulseCheckCapabilityFacts,
): AutoPulseCheckPlan {
  const roadMandatory = purpose === 'PRE_PURCHASE' || purpose === 'PRE_TRIP' || purpose === 'FLEET';
  const steps: AutoPulseCheckPlanStep[] = [
    {
      id: 'INTAKE',
      title: 'Evaluation intake',
      order: 10,
      mandatory: true,
      availability: 'AVAILABLE',
      evidenceOrigin: EvidenceOrigin.TECHNICIAN_OBSERVATION,
    },
    {
      id: 'VISUAL_BASELINE',
      title: 'Visual and manual baseline',
      order: 20,
      mandatory: true,
      availability: 'AVAILABLE',
      evidenceOrigin: EvidenceOrigin.TECHNICIAN_OBSERVATION,
    },
    {
      id: 'CAPABILITY_DISCOVERY',
      title: 'Vehicle and adapter capability discovery',
      order: 30,
      mandatory: true,
      availability: availabilityOf(capabilities.obd),
      evidenceOrigin: EvidenceOrigin.OBD_CAPTURE,
      limitation: limitationFor('OBD capability discovery', capabilities.obd),
    },
    {
      id: 'DTC_SCAN',
      title: 'Read diagnostic trouble codes',
      order: 40,
      mandatory: true,
      availability: availabilityOf(capabilities.dtcRead),
      evidenceOrigin: EvidenceOrigin.OBD_CAPTURE,
      limitation: limitationFor('DTC reading', capabilities.dtcRead),
    },
    {
      id: 'READINESS_SCAN',
      title: 'Read OBD readiness monitors',
      order: 50,
      mandatory: true,
      availability: availabilityOf(capabilities.readiness),
      evidenceOrigin: EvidenceOrigin.OBD_CAPTURE,
      limitation: limitationFor('Readiness monitoring', capabilities.readiness),
    },
    {
      id: 'FREEZE_FRAME',
      title: 'Capture freeze-frame evidence when available',
      order: 60,
      mandatory: false,
      availability: capabilities.freezeFrame === 'SUPPORTED'
        ? 'CONDITIONAL'
        : availabilityOf(capabilities.freezeFrame),
      evidenceOrigin: EvidenceOrigin.OBD_CAPTURE,
      limitation: limitationFor('Freeze-frame capture', capabilities.freezeFrame),
    },
    {
      id: 'IDLE_TELEMETRY',
      title: 'Controlled idle telemetry window',
      order: 70,
      mandatory: true,
      availability: availabilityOf(capabilities.liveTelemetry),
      evidenceOrigin: EvidenceOrigin.LIVE_TELEMETRY_WINDOW,
      captureContext: CaptureContext.IDLE,
      limitation: limitationFor('Live ECU telemetry', capabilities.liveTelemetry),
    },
    {
      id: 'ROAD_TELEMETRY',
      title: 'Controlled road telemetry window',
      order: 80,
      mandatory: roadMandatory,
      availability: availabilityOf(capabilities.liveTelemetry),
      evidenceOrigin: EvidenceOrigin.LIVE_TELEMETRY_WINDOW,
      captureContext: CaptureContext.ROAD_TEST,
      limitation: limitationFor('Road telemetry', capabilities.liveTelemetry),
    },
    {
      id: 'PROFESSIONAL_REVIEW',
      title: 'Review observations and findings',
      order: 90,
      mandatory: true,
      availability: 'AVAILABLE',
      evidenceOrigin: EvidenceOrigin.TECHNICIAN_OBSERVATION,
    },
    {
      id: 'REPORT_FINALIZATION',
      title: 'Finalize immutable evaluation report',
      order: 100,
      mandatory: true,
      availability: 'AVAILABLE',
      evidenceOrigin: EvidenceOrigin.SYSTEM_DERIVED,
    },
  ];

  const limitations = steps
    .map(step => step.limitation)
    .filter((value): value is string => Boolean(value));

  return { purpose, steps, limitations };
}
