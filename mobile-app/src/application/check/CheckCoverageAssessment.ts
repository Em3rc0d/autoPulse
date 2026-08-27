import { StoredAutoPulseCheck } from './AutoPulseCheckEngine';
import { AutoPulseCheckPlanStep, buildAutoPulseCheckPlan } from './AutoPulseCheckPlan';
import { CoverageAssessment } from '../../domain/evaluation/models/coverageAssessment';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { CaptureContext, CoverageLevel, EvidenceState } from '../../domain/evaluation/models/enums';

export interface CheckCoverageResult {
  readonly coverage: CoverageAssessment;
  readonly limitations: readonly string[];
}

function matchingEvidence(step: AutoPulseCheckPlanStep, evidence: readonly EvidenceItem[]): EvidenceItem | undefined {
  switch (step.id) {
    case 'VISUAL_BASELINE':
      return evidence.find(item => item.type === 'CHECK_VISUAL_BASELINE');
    case 'CAPABILITY_DISCOVERY':
      return evidence.find(item => item.type === 'OBD_CAPABILITY_DISCOVERY');
    case 'DTC_SCAN':
      return evidence.find(item => item.type === 'OBD_STORED_DTC_SCAN');
    case 'READINESS_SCAN':
      return evidence.find(item => item.type === 'OBD_MONITOR_STATUS_PID01');
    case 'FREEZE_FRAME':
      return evidence.find(item => item.type === 'OBD_FREEZE_FRAME_TRIGGER');
    case 'IDLE_TELEMETRY':
      return evidence.find(item =>
        item.type === 'LIVE_OBD_TELEMETRY_WINDOW'
        && item.metadata?.captureContext === CaptureContext.IDLE
      );
    case 'ROAD_TELEMETRY':
      return evidence.find(item =>
        item.type === 'LIVE_OBD_TELEMETRY_WINDOW'
        && item.metadata?.captureContext === CaptureContext.ROAD_TEST
      );
    default:
      return undefined;
  }
}

function coverageReason(step: AutoPulseCheckPlanStep, item?: EvidenceItem): string | undefined {
  if (step.id === 'INTAKE') return undefined;
  if (step.availability === 'UNAVAILABLE') {
    return step.limitation ?? `${step.title} was unavailable for the observed capability set.`;
  }
  if (step.availability === 'UNKNOWN') {
    return step.limitation ?? `${step.title} capability was not proven during this evaluation.`;
  }
  if (!item) return `No evidence was captured for ${step.title}.`;
  if (item.state !== EvidenceState.COMMITTED) {
    return `${step.title} was attempted but did not produce committed evidence (${item.state}).`;
  }
  return undefined;
}

export function assessCheckCoverage(
  check: StoredAutoPulseCheck,
  evidence: readonly EvidenceItem[],
  assessedAt: string,
): CheckCoverageResult {
  const plan = buildAutoPulseCheckPlan(check.purpose, check.capabilities);
  const assessmentSteps = plan.steps.filter(step =>
    step.id !== 'PROFESSIONAL_REVIEW' && step.id !== 'REPORT_FINALIZATION'
  );

  const assessedItems = assessmentSteps.map(step => {
    if (step.id === 'INTAKE') {
      return { moduleName: step.title, isCovered: true };
    }
    const item = matchingEvidence(step, evidence);
    const reasonIfNotCovered = coverageReason(step, item);
    return {
      moduleName: step.title,
      isCovered: !reasonIfNotCovered,
      reasonIfNotCovered,
    };
  });

  const mandatorySteps = assessmentSteps.filter(step => step.mandatory && step.id !== 'INTAKE');
  const mandatoryItems = mandatorySteps.map(step => {
    const item = matchingEvidence(step, evidence);
    return { step, reason: coverageReason(step, item) };
  });
  const coveredMandatory = mandatoryItems.filter(item => !item.reason).length;

  const overallLevel = mandatoryItems.length > 0 && coveredMandatory === mandatoryItems.length
    ? CoverageLevel.HIGH
    : coveredMandatory > 0
      ? CoverageLevel.PARTIAL
      : CoverageLevel.LIMITED;

  const limitations = Array.from(new Set([
    ...plan.limitations,
    ...mandatoryItems.map(item => item.reason).filter((reason): reason is string => Boolean(reason)),
  ]));

  return {
    coverage: {
      overallLevel,
      assessedItems,
      assessedAt,
    },
    limitations,
  };
}
