export type AdapterBehaviorRequirement = 'REQUIRED' | 'PREFERRED' | 'OPTIONAL';

export type AdapterInitializationBehaviorKey =
  | 'AT_CHANNEL'
  | 'ECHO_CONTROL'
  | 'LINEFEED_CONTROL'
  | 'SPACES_CONTROL'
  | 'HEADERS_CONTROL'
  | 'AUTO_PROTOCOL_SELECTION'
  | 'ADAPTER_IDENTITY'
  | 'SUPPLY_VOLTAGE';

export type AdapterInitializationCheckOutcome =
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'NO_RESPONSE'
  | 'WRITE_FAILED'
  | 'DISCONNECTED'
  | 'UNRECOGNIZED_RESPONSE';

export interface AdapterInitializationBehaviorSpec {
  key: AdapterInitializationBehaviorKey;
  requirement: AdapterBehaviorRequirement;
  command?: string;
  rationale: string;
}

export interface AdapterInitializationCheck {
  behavior: AdapterInitializationBehaviorKey;
  requirement: AdapterBehaviorRequirement;
  command: string;
  outcome: AdapterInitializationCheckOutcome;
  response: string | null;
  latencyMs: number;
  timedOut: boolean;
  promptDetected: boolean;
}

/**
 * Release-1 adapter behavior policy.
 *
 * REQUIRED means AutoPulse cannot safely operate without the behavior.
 * PREFERRED means failure lowers confidence but can be normalized/worked
 * around by AutoPulse.
 * OPTIONAL enriches evidence/product UX but never controls compatibility.
 */
export const ADAPTER_INITIALIZATION_BEHAVIOR_POLICY: readonly AdapterInitializationBehaviorSpec[] = [
  {
    key: 'AT_CHANNEL',
    requirement: 'REQUIRED',
    rationale: 'A trustworthy writable request/response channel is the minimum adapter contract.',
  },
  {
    key: 'ECHO_CONTROL',
    requirement: 'PREFERRED',
    command: 'ATE0\r',
    rationale: 'Disabling echo simplifies framing, but AutoPulse can remove echoed commands itself.',
  },
  {
    key: 'LINEFEED_CONTROL',
    requirement: 'PREFERRED',
    command: 'ATL0\r',
    rationale: 'Linefeed control reduces formatting variance, but the normalizer can absorb line breaks.',
  },
  {
    key: 'SPACES_CONTROL',
    requirement: 'PREFERRED',
    command: 'ATS0\r',
    rationale: 'Space control is cosmetic because AutoPulse normalizes whitespace.',
  },
  {
    key: 'HEADERS_CONTROL',
    requirement: 'PREFERRED',
    command: 'ATH0\r',
    rationale: 'Header formatting is configurable, but parser behavior must not depend on one presentation.',
  },
  {
    key: 'AUTO_PROTOCOL_SELECTION',
    requirement: 'PREFERRED',
    command: 'ATSP0\r',
    rationale: 'Automatic protocol selection is preferred; explicit protocol fallback remains possible in vehicle discovery.',
  },
  {
    key: 'ADAPTER_IDENTITY',
    requirement: 'OPTIONAL',
    rationale: 'ATI/AT@1 identity is useful fingerprint evidence but never compatibility authority.',
  },
  {
    key: 'SUPPLY_VOLTAGE',
    requirement: 'OPTIONAL',
    rationale: 'ATRV enriches adapter telemetry but is not required for vehicle diagnostics.',
  },
] as const;

export const PROBED_ADAPTER_BEHAVIORS = ADAPTER_INITIALIZATION_BEHAVIOR_POLICY.filter(
  (spec): spec is AdapterInitializationBehaviorSpec & { command: string } => Boolean(spec.command)
);
