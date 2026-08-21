export type AdapterBehaviorRequirement = 'PREFERRED' | 'OPTIONAL';
export type AdapterBehaviorOutcome = 'PASS' | 'FAIL' | 'TIMEOUT' | 'DISCONNECTED';

export interface AdapterBehaviorCheck {
  command: string;
  requirement: AdapterBehaviorRequirement;
  outcome: AdapterBehaviorOutcome;
  sanitizedResponse?: string;
  latencyMs: number;
  promptObserved: boolean;
}

export interface AdapterBehaviorAssessment {
  schemaVersion: '1.0';
  checks: AdapterBehaviorCheck[];
  preferredFailures: string[];
  optionalFailures: string[];
  disconnectObserved: boolean;
  /**
   * Evidence flag only. This never promotes compatibilityGrade to CERTIFIED.
   * Physical/certification matrix evidence is still required later.
   */
  certificationReady: boolean;
}
