import type { DriverAlertDefinition, DriverAlertSeverity } from './DriverAlertLexicon';

export type AlertLifecycleState = 'INACTIVE' | 'ACTIVE' | 'UNRESOLVED' | 'RECOVERING' | 'RESOLVED';

export interface AlertEpisode {
  state: AlertLifecycleState;
  alert?: DriverAlertDefinition;
  currentSeverity?: DriverAlertSeverity;
  peakSeverity?: DriverAlertSeverity;
  startedAt?: number;
  lastConfirmedAt?: number;
  recoveryCandidateSince?: number;
  reason?: string;
}

export interface AlertLifecycleInput {
  detectedAlert: DriverAlertDefinition | null;
  evidenceAvailable: boolean;
  nowMs: number;
  recoveryConfirmMs?: number;
}

const severityRank: Record<DriverAlertSeverity, number> = {
  S0_NORMAL: 0,
  S1_ADVISORY: 1,
  S2_ATTENTION: 2,
  S3_CRITICAL: 3,
};

export const INACTIVE_ALERT_EPISODE: AlertEpisode = { state: 'INACTIVE' };

export function advanceAlertLifecycle(
  previous: AlertEpisode,
  input: AlertLifecycleInput,
): AlertEpisode {
  const recoveryConfirmMs = input.recoveryConfirmMs ?? 3_000;
  const { detectedAlert, evidenceAvailable, nowMs } = input;

  if (detectedAlert) {
    const previousPeak = previous.peakSeverity;
    const peakSeverity = !previousPeak || severityRank[detectedAlert.severity] > severityRank[previousPeak]
      ? detectedAlert.severity
      : previousPeak;

    return {
      state: 'ACTIVE',
      alert: detectedAlert,
      currentSeverity: detectedAlert.severity,
      peakSeverity,
      startedAt: previous.startedAt ?? nowMs,
      lastConfirmedAt: nowMs,
      reason: previous.state === 'RECOVERING' ? 'CONDITION_RETURNED' : 'CONDITION_CONFIRMED',
    };
  }

  if (previous.state === 'INACTIVE' || previous.state === 'RESOLVED') {
    return INACTIVE_ALERT_EPISODE;
  }

  if (!evidenceAvailable) {
    return {
      ...previous,
      state: 'UNRESOLVED',
      recoveryCandidateSince: undefined,
      reason: 'EVIDENCE_LOST_RECOVERY_NOT_CONFIRMED',
    };
  }

  const recoveryCandidateSince = previous.state === 'RECOVERING'
    ? previous.recoveryCandidateSince ?? nowMs
    : nowMs;

  if (nowMs - recoveryCandidateSince >= recoveryConfirmMs) {
    return {
      ...previous,
      state: 'RESOLVED',
      currentSeverity: undefined,
      recoveryCandidateSince,
      reason: 'RECOVERY_CONFIRMED',
    };
  }

  return {
    ...previous,
    state: 'RECOVERING',
    currentSeverity: previous.currentSeverity,
    recoveryCandidateSince,
    reason: 'RECOVERY_CANDIDATE',
  };
}

export function lifecyclePresentationAlert(episode: AlertEpisode): DriverAlertDefinition | null {
  return episode.state === 'ACTIVE' ? episode.alert ?? null : null;
}

export function isUnresolvedAlert(episode: AlertEpisode): boolean {
  return episode.state === 'UNRESOLVED';
}
