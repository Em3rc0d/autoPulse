import type { ProfileMatchType } from './ProbeResult';
import type { AdapterInitializationCheck } from './AdapterInitializationBehavior';

export type AdapterCompatibilityGrade =
  | 'CERTIFIED'
  | 'COMPATIBLE'
  | 'DEGRADED'
  | 'UNSUPPORTED';

export interface AdapterBehaviorEvidence {
  profileMatch: ProfileMatchType;
  writeAccepted: boolean;
  responseReceived: boolean;
  protocolResponseValid: boolean;
  promptDetected: boolean;
  timedOut: boolean;
  disconnectObserved: boolean;
  latencyMs: number;
  receiveMode: 'NOTIFY' | 'INDICATE' | 'READ';
  writeMode: 'WITH_RESPONSE' | 'WITHOUT_RESPONSE';
  initializationChecks?: AdapterInitializationCheck[];
}

export interface AdapterCompatibilityAssessment {
  grade: AdapterCompatibilityGrade;
  reasons: string[];
}

/**
 * Release-1 adapter grading is behavior-first.
 * A known GATT profile can raise a proven-good adapter to CERTIFIED, but
 * identity/profile matching can never rescue missing or unreliable behavior.
 */
export class AdapterCompatibilityClassifier {
  static classify(evidence: AdapterBehaviorEvidence): AdapterCompatibilityAssessment {
    const reasons: string[] = [];

    if (evidence.disconnectObserved) {
      return { grade: 'UNSUPPORTED', reasons: ['DISCONNECTED_DURING_PROBE'] };
    }

    if (!evidence.writeAccepted) {
      return { grade: 'UNSUPPORTED', reasons: ['WRITE_NOT_ACCEPTED'] };
    }

    if (!evidence.responseReceived || !evidence.protocolResponseValid) {
      return { grade: 'UNSUPPORTED', reasons: ['NO_VALID_AT_RESPONSE'] };
    }

    const checks = evidence.initializationChecks || [];
    const disconnectedCheck = checks.find(check => check.outcome === 'DISCONNECTED');
    if (disconnectedCheck) {
      return {
        grade: 'UNSUPPORTED',
        reasons: [`DISCONNECTED_DURING_INITIALIZATION_BEHAVIOR:${disconnectedCheck.behavior}`],
      };
    }

    const requiredFailure = checks.find(
      check => check.requirement === 'REQUIRED' && check.outcome !== 'ACKNOWLEDGED'
    );
    if (requiredFailure) {
      return {
        grade: 'UNSUPPORTED',
        reasons: [`REQUIRED_BEHAVIOR_UNAVAILABLE:${requiredFailure.behavior}:${requiredFailure.outcome}`],
      };
    }

    if (evidence.timedOut) reasons.push('RESPONSE_TIMEOUT');
    if (!evidence.promptDetected) reasons.push('PROMPT_NOT_OBSERVED');
    if (evidence.receiveMode === 'READ') reasons.push('READ_POLLING_FALLBACK');

    for (const check of checks) {
      if (check.requirement !== 'PREFERRED') continue;

      if (check.outcome !== 'ACKNOWLEDGED') {
        reasons.push(`PREFERRED_BEHAVIOR_UNAVAILABLE:${check.behavior}:${check.outcome}`);
        continue;
      }

      if (check.timedOut || !check.promptDetected) {
        reasons.push(`PREFERRED_BEHAVIOR_UNRELIABLE:${check.behavior}`);
      }
    }

    if (reasons.length > 0) {
      return { grade: 'DEGRADED', reasons };
    }

    if (evidence.profileMatch === 'EXACT_PROFILE_MATCH') {
      return { grade: 'CERTIFIED', reasons: ['EXACT_PROFILE_AND_BEHAVIOR_VERIFIED'] };
    }

    reasons.push(
      evidence.profileMatch === 'PARTIAL_PROFILE_MATCH'
        ? 'PARTIAL_PROFILE_BEHAVIOR_VERIFIED'
        : 'GENERIC_BEHAVIOR_VERIFIED'
    );
    return { grade: 'COMPATIBLE', reasons };
  }
}
