import type { DriverAdvisory } from './models';

export type StartupAssessmentPhase =
  | 'CONNECTING'
  | 'QUICK_CHECK'
  | 'DIAGNOSTIC_SCAN'
  | 'COLD_START_OBSERVATION'
  | 'READY';

export interface StartupAssessmentInput {
  connected: boolean;
  criticalChecksComplete: boolean;
  diagnosticScanComplete: boolean;
  coldStartObservationComplete: boolean;
  startedAt: number;
  now: number;
  advisories?: readonly DriverAdvisory[];
}

export interface StartupAssessmentState {
  phase: StartupAssessmentPhase;
  canBrief: boolean;
  canDriveLive: boolean;
  scanInProgress: boolean;
  criticalFindingPresent: boolean;
}

const hasCriticalFinding = (advisories: readonly DriverAdvisory[] = []) =>
  advisories.some(advisory => advisory.severity === 'CRITICAL' || advisory.severity === 'WARNING');

/**
 * Startup is deliberately progressive. A driver may enter Live telemetry before the
 * full diagnostic/cold-start observation is complete, but AutoPulse must not emit a
 * definitive startup briefing until the diagnostic scan and cold-start observation
 * have matured. Critical/warning findings may interrupt immediately.
 */
export function resolveStartupAssessment(input: StartupAssessmentInput): StartupAssessmentState {
  const criticalFindingPresent = hasCriticalFinding(input.advisories);

  if (!input.connected) {
    return {
      phase: 'CONNECTING',
      canBrief: false,
      canDriveLive: false,
      scanInProgress: true,
      criticalFindingPresent,
    };
  }

  if (!input.criticalChecksComplete) {
    return {
      phase: 'QUICK_CHECK',
      canBrief: criticalFindingPresent,
      canDriveLive: true,
      scanInProgress: true,
      criticalFindingPresent,
    };
  }

  if (!input.diagnosticScanComplete) {
    return {
      phase: 'DIAGNOSTIC_SCAN',
      canBrief: criticalFindingPresent,
      canDriveLive: true,
      scanInProgress: true,
      criticalFindingPresent,
    };
  }

  if (!input.coldStartObservationComplete) {
    return {
      phase: 'COLD_START_OBSERVATION',
      canBrief: criticalFindingPresent,
      canDriveLive: true,
      scanInProgress: true,
      criticalFindingPresent,
    };
  }

  return {
    phase: 'READY',
    canBrief: true,
    canDriveLive: true,
    scanInProgress: false,
    criticalFindingPresent,
  };
}
