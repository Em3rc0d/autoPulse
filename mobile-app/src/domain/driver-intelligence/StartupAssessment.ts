import type { DriverAdvisory } from './models';

export type StartupAssessmentPhase =
  | 'CONNECTING'
  | 'QUICK_CHECK'
  | 'CHARACTERIZATION'
  | 'COLD_START_OBSERVATION'
  | 'READY';

export interface StartupAssessmentInput {
  connected: boolean;
  preflightReachabilityVerified: boolean;
  characterizationComplete: boolean;
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
 * read-only OBD characterization and cold-start observation have completed.
 * PRE-FLIGHT READY never certifies a comprehensive Check or vehicle health.
 * Warnings can still be presented before the normal startup briefing.
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

  if (!input.preflightReachabilityVerified) {
    return {
      phase: 'QUICK_CHECK',
      canBrief: criticalFindingPresent,
      canDriveLive: true,
      scanInProgress: true,
      criticalFindingPresent,
    };
  }

  if (!input.characterizationComplete) {
    return {
      phase: 'CHARACTERIZATION',
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
