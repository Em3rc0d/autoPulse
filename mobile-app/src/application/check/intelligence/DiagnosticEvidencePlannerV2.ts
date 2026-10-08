import { resolveDtcKnowledge } from './DtcKnowledgeWallet';
import { findPidWalletEntry, isCheckV4ExecutablePid, type DiagnosticEvidenceFamily } from './PidWallet';

export type EvidencePlanSelectionReason =
  | 'READINESS_BASELINE'
  | 'DTC_RELATED'
  | 'BASELINE_CONTEXT'
  | 'BOUNDED_FALLBACK';

export interface EvidencePlanRequest {
  readonly pid: string;
  readonly semanticId: string;
  readonly reason: EvidencePlanSelectionReason;
  readonly relatedDtcs: readonly string[];
  readonly evidenceFamilies: readonly DiagnosticEvidenceFamily[];
  readonly advertised: boolean;
}

export interface DiagnosticEvidencePlanV2 {
  readonly version: 'check-evidence-planner/v3';
  readonly requests: readonly EvidencePlanRequest[];
  readonly skippedPids: readonly string[];
  readonly advertisedPidCount: number;
  readonly dtcCount: number;
  readonly alreadyObservedPidCount: number;
  readonly provenance: string;
}

const FAMILY_PRIORITY: Readonly<Record<DiagnosticEvidenceFamily, readonly string[]>> = Object.freeze({
  READINESS: ['01','30','31','21','4D','4E'],
  COMBUSTION: ['04','0C','0E','0B','06','07','0F','11','61','62','63','5D'],
  AIR_FUEL: ['06','07','0B','0F','10','14','15','04','0C','11'],
  CATALYST: ['14','15','3C','3D','3E','3F','04','05','0C','06','07','0F'],
  COOLING: ['05','5C','0F','04','0C'],
  O2_SENSOR: ['14','15','06','07','0C','04'],
  ELECTRICAL: ['42'],
  AIR_METERING: ['0B','10','0F','11','33','04','0C'],
  FUEL_DELIVERY: ['06','07','0A','2F','5D','5E','04','0C','0B'],
  EGR: ['04','0B','0C','0F'],
  EVAP: ['04','05','2F','0C'],
  TRANSMISSION: ['0C','0D','04'],
  CONTEXT: ['05','0C','0D','04','42','1F','2F','33','46','0F'],
});

/**
 * Bounded vehicle snapshot. This is intentionally much smaller than the
 * 114-PID knowledge wallet and contains only deterministic, read-only promoted
 * decoders. Capability evidence still gates requests whenever it is conclusive.
 */
export const CHECK_ADAPTIVE_BASELINE_PIDS = Object.freeze([
  '01', // MIL + readiness
  '04', // load
  '05', // coolant
  '0C', // RPM
  '0D', // speed
  '0B', // MAP
  '0F', // intake temperature
  '10', // MAF
  '11', // throttle
  '42', // ECU voltage
  '1F', // runtime
  '2F', // fuel level
  '33', // barometric pressure
  '46', // ambient temperature
  '5C', // oil temperature
  '06', // STFT B1
  '07', // LTFT B1
  '0E', // timing
  '14', // O2 B1S1 style evidence
  '15', // O2 B1S2 style evidence
  '0A', // fuel pressure
  '30', // warm-ups since clear
  '31', // distance since clear
  '21', // distance MIL on
  '4D', // time MIL on
  '4E', // time since clear
  '5E', // fuel rate
  '61', // torque demand
  '62', // actual torque
  '63', // reference torque
] as const);

const FALLBACK_ALLOWLIST = new Set<string>(CHECK_ADAPTIVE_BASELINE_PIDS);

export interface BuildEvidencePlanInput {
  readonly dtcCodes: readonly string[];
  /** Mode 01 request ids such as 0104. They remain response-scoped evidence upstream. */
  readonly advertisedPids: readonly string[];
  readonly capabilityInconclusive: boolean;
  /** PIDs already observed by an earlier bounded phase, e.g. Logan KWP corroboration. */
  readonly alreadyObservedPids?: readonly string[];
  readonly maxCommands?: number;
}

function normalizePid(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  if (/^[0-9A-F]{2}$/.test(normalized)) return normalized;
  if (/^01[0-9A-F]{2}$/.test(normalized)) return normalized.slice(2);
  return undefined;
}

export function buildDiagnosticEvidencePlanV2(input: BuildEvidencePlanInput): DiagnosticEvidencePlanV2 {
  const maxCommands = Math.max(1, Math.min(18, input.maxCommands ?? 18));
  const advertised = new Set(
    input.advertisedPids
      .map(value => value.trim().toUpperCase())
      .filter(value => /^01[0-9A-F]{2}$/.test(value)),
  );
  const alreadyObserved = new Set(
    (input.alreadyObservedPids ?? [])
      .map(normalizePid)
      .filter((value): value is string => Boolean(value)),
  );
  const codes = [...new Set(input.dtcCodes.map(value => value.trim().toUpperCase()).filter(Boolean))];
  const families = new Map<DiagnosticEvidenceFamily, Set<string>>();

  for (const code of codes) {
    const knowledge = resolveDtcKnowledge(code);
    for (const family of knowledge?.concernFamilies ?? ['CONTEXT' as const]) {
      const related = families.get(family) ?? new Set<string>();
      related.add(code);
      families.set(family, related);
    }
  }

  const requested = new Map<string, EvidencePlanRequest>();
  const candidate = new Set<string>();

  const add = (
    pid: string,
    reason: EvidencePlanSelectionReason,
    relatedDtcs: readonly string[],
    evidenceFamilies: readonly DiagnosticEvidenceFamily[],
  ) => {
    candidate.add(pid);
    if (
      requested.size >= maxCommands
      || requested.has(pid)
      || alreadyObserved.has(pid)
      || !isCheckV4ExecutablePid(pid)
    ) return;

    const requestId = `01${pid}`;
    const isAdvertised = advertised.has(requestId);

    // Conclusive capability evidence is authoritative for request selection.
    // Inconclusive evidence permits only the explicit bounded fallback set.
    if (!isAdvertised && !(input.capabilityInconclusive && FALLBACK_ALLOWLIST.has(pid))) return;

    requested.set(pid, Object.freeze({
      pid,
      semanticId: `check.obd.mode01.observe.${pid}`,
      reason: isAdvertised ? reason : 'BOUNDED_FALLBACK',
      relatedDtcs: Object.freeze([...relatedDtcs]),
      evidenceFamilies: Object.freeze([...evidenceFamilies]),
      advertised: isAdvertised,
    }));
  };

  // Always prioritize readiness when it has not already been observed.
  add('01', 'READINESS_BASELINE', codes, ['READINESS']);

  // DTC-related evidence receives priority over general context.
  for (const [family, related] of families) {
    for (const pid of FAMILY_PRIORITY[family]) {
      const wallet = findPidWalletEntry(pid);
      add(pid, 'DTC_RELATED', [...related], wallet?.evidenceFamilies ?? [family]);
    }
  }

  // Fill remaining budget with a useful vehicle snapshot even when there are
  // no DTCs. This is what turns Check from a DTC-only pilot into a bounded
  // adaptive diagnostic snapshot without ever walking the 114-PID wallet.
  for (const pid of CHECK_ADAPTIVE_BASELINE_PIDS) {
    const wallet = findPidWalletEntry(pid);
    add(pid, pid === '01' ? 'READINESS_BASELINE' : 'BASELINE_CONTEXT', [], wallet?.evidenceFamilies ?? ['CONTEXT']);
  }

  const skippedPids = [...candidate].filter(pid => !requested.has(pid) && !alreadyObserved.has(pid));

  return Object.freeze({
    version: 'check-evidence-planner/v3' as const,
    requests: Object.freeze([...requested.values()]),
    skippedPids: Object.freeze(skippedPids),
    advertisedPidCount: advertised.size,
    dtcCount: codes.length,
    alreadyObservedPidCount: alreadyObserved.size,
    provenance: 'CHECK v5: 114-PID reference wallet + bounded adaptive snapshot + DTC-driven enrichment; no blind PID sweep',
  });
}
