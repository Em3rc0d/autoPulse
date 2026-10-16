import { resolveDtcKnowledge } from './DtcKnowledgeWallet';
import { findPidWalletEntry, isCheckV4ExecutablePid, type DiagnosticEvidenceFamily } from './PidWallet';

export type EvidencePlanSelectionReason = 'READINESS_BASELINE' | 'DTC_RELATED' | 'BOUNDED_FALLBACK';

export interface EvidencePlanRequest {
  readonly pid: string;
  readonly semanticId: string;
  readonly reason: EvidencePlanSelectionReason;
  readonly relatedDtcs: readonly string[];
  readonly evidenceFamilies: readonly DiagnosticEvidenceFamily[];
  readonly advertised: boolean;
}

export interface DiagnosticEvidencePlanV2 {
  readonly version: 'check-evidence-planner/v2';
  readonly requests: readonly EvidencePlanRequest[];
  readonly skippedPids: readonly string[];
  readonly advertisedPidCount: number;
  readonly dtcCount: number;
  readonly provenance: string;
}

const FAMILY_PRIORITY: Readonly<Record<DiagnosticEvidenceFamily, readonly string[]>> = Object.freeze({
  READINESS: ['01'],
  COMBUSTION: ['04','05','0C','0E','0B','06','07','0F','11'],
  AIR_FUEL: ['06','07','0B','0F','14','15','04','0C','11'],
  CATALYST: ['14','15','04','05','0C','06','07','0F'],
  COOLING: ['05','0F','04','0C'],
  O2_SENSOR: ['14','15','06','07','0C','04'],
  ELECTRICAL: [],
  AIR_METERING: ['0B','0F','11','04','0C'],
  FUEL_DELIVERY: ['06','07','04','0C','0B'],
  EGR: ['04','0B','0C','0F'],
  EVAP: ['04','05','0C'],
  TRANSMISSION: ['0C','0D','04'],
  CONTEXT: ['05','0C','0D','04','0F'],
});

const FALLBACK_ALLOWLIST = new Set(['01','04','05','06','07','0B','0C','0D','0E','0F','11','14','15']);

export interface BuildEvidencePlanInput {
  readonly dtcCodes: readonly string[];
  /** Mode 01 request ids such as 0104. They remain response-scoped evidence upstream. */
  readonly advertisedPids: readonly string[];
  readonly capabilityInconclusive: boolean;
  readonly maxCommands?: number;
}

export function buildDiagnosticEvidencePlanV2(input: BuildEvidencePlanInput): DiagnosticEvidencePlanV2 {
  const maxCommands = Math.max(1, Math.min(12, input.maxCommands ?? 12));
  const advertised = new Set(input.advertisedPids.map(value => value.trim().toUpperCase()).filter(value => /^01[0-9A-F]{2}$/.test(value)));
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
  const add = (pid: string, reason: EvidencePlanSelectionReason, relatedDtcs: readonly string[], evidenceFamilies: readonly DiagnosticEvidenceFamily[]) => {
    if (requested.size >= maxCommands || requested.has(pid) || !isCheckV4ExecutablePid(pid)) return;
    const requestId = `01${pid}`;
    const isAdvertised = advertised.has(requestId);
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

  // PID 0101 is the Check v4 baseline for MIL/readiness and is never interpreted as a health verdict.
  add('01', 'READINESS_BASELINE', codes, ['READINESS']);

  for (const [family, related] of families) {
    for (const pid of FAMILY_PRIORITY[family]) {
      const wallet = findPidWalletEntry(pid);
      add(pid, 'DTC_RELATED', [...related], wallet?.evidenceFamilies ?? [family]);
    }
  }

  const candidate = new Set<string>(['01']);
  for (const family of families.keys()) for (const pid of FAMILY_PRIORITY[family]) candidate.add(pid);
  const skippedPids = [...candidate].filter(pid => !requested.has(pid));

  return Object.freeze({
    version: 'check-evidence-planner/v2' as const,
    requests: Object.freeze([...requested.values()]),
    skippedPids: Object.freeze(skippedPids),
    advertisedPidCount: advertised.size,
    dtcCount: codes.length,
    provenance: 'CHECK v4: large reference wallet + selective concern-driven execution; no blind PID sweep',
  });
}
