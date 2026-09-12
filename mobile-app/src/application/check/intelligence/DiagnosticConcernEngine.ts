import type { DtcServiceParseResult } from '../parsers/DtcServiceParser';
import type { DecodedPidObservation } from './Mode01ValueDecoder';
import { resolveDtcKnowledge, type DtcKnowledgeEntry } from './DtcKnowledgeWallet';
import type { DiagnosticEvidenceFamily } from './PidWallet';

export type DiagnosticEventConfidence = 'CONFIRMED_BY_ECU' | 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';
export type DiagnosticCauseConfidence = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';

export interface DiagnosticConcernV2 {
  readonly concernId: string;
  readonly code: string;
  readonly title: string;
  readonly statuses: readonly ('STORED' | 'PENDING' | 'PERMANENT')[];
  readonly families: readonly DiagnosticEvidenceFamily[];
  readonly eventConfidence: DiagnosticEventConfidence;
  readonly causeConfidence: DiagnosticCauseConfidence;
  readonly relatedEvidence: readonly DecodedPidObservation[];
  readonly possibleSystemGroups: readonly string[];
  readonly limitations: readonly string[];
  readonly knowledge: DtcKnowledgeEntry;
}

function systemGroups(families: readonly DiagnosticEvidenceFamily[]): string[] {
  const groups = new Set<string>();
  if (families.includes('COMBUSTION')) groups.add('Ignition / combustion');
  if (families.includes('FUEL_DELIVERY')) groups.add('Fuel delivery');
  if (families.includes('AIR_FUEL')) groups.add('Air / fuel mixture');
  if (families.includes('AIR_METERING')) groups.add('Air metering / intake');
  if (families.includes('CATALYST')) groups.add('Catalyst / exhaust aftertreatment');
  if (families.includes('O2_SENSOR')) groups.add('Oxygen-sensor feedback');
  if (families.includes('COOLING')) groups.add('Cooling system');
  if (families.includes('EVAP')) groups.add('Evaporative emissions');
  if (families.includes('EGR')) groups.add('EGR / airflow');
  if (groups.size === 0) groups.add('Further diagnosis required');
  return [...groups];
}

function fallbackKnowledge(code: string): DtcKnowledgeEntry {
  return Object.freeze({
    code,
    family: 'POWERTRAIN' as const,
    namespace: 'UNKNOWN' as const,
    concernFamilies: Object.freeze<DiagnosticEvidenceFamily[]>(['CONTEXT']),
    provenance: 'Unresolved DTC knowledge; ECU event retained without fabricated meaning',
  });
}

export function buildDiagnosticConcerns(
  dtcResults: readonly DtcServiceParseResult[],
  pidEvidence: readonly DecodedPidObservation[],
): readonly DiagnosticConcernV2[] {
  const byCode = new Map<string, Set<'STORED' | 'PENDING' | 'PERMANENT'>>();
  for (const result of dtcResults) {
    if (result.outcome !== 'SUCCESS_WITH_CODES') continue;
    for (const item of result.codes) {
      const statuses = byCode.get(item.code) ?? new Set<'STORED' | 'PENDING' | 'PERMANENT'>();
      statuses.add(result.status);
      byCode.set(item.code, statuses);
    }
  }

  return Object.freeze([...byCode.entries()].map(([code, statusSet]) => {
    const knowledge: DtcKnowledgeEntry = resolveDtcKnowledge(code) ?? fallbackKnowledge(code);
    const families: readonly DiagnosticEvidenceFamily[] = knowledge.concernFamilies;
    const evidence = pidEvidence.filter(observation => {
      const walletFamilies: readonly DiagnosticEvidenceFamily[] = observation.pid === '01' ? ['READINESS'] : [];
      return families.includes('CONTEXT') || walletFamilies.some(family => families.includes(family)) || observation.signals.some(signal => {
        const key = signal.key.toLowerCase();
        if (families.includes('AIR_FUEL') && (key.includes('trim') || key.includes('o2'))) return true;
        if (families.includes('CATALYST') && key.includes('o2')) return true;
        if (families.includes('COMBUSTION') && (key.includes('rpm') || key.includes('load') || key.includes('timing'))) return true;
        if (families.includes('COOLING') && (key.includes('coolant') || key.includes('iat'))) return true;
        if (families.includes('AIR_METERING') && (key.includes('map') || key.includes('throttle') || key.includes('iat'))) return true;
        if (families.includes('FUEL_DELIVERY') && key.includes('trim')) return true;
        return false;
      });
    });
    const statuses = [...statusSet];
    return Object.freeze({
      concernId: `dtc:${code}`,
      code,
      title: knowledge.canonicalMeaning ?? 'Diagnostic trouble code reported',
      statuses: Object.freeze(statuses),
      families: Object.freeze([...families]),
      eventConfidence: 'CONFIRMED_BY_ECU' as const,
      causeConfidence: 'INSUFFICIENT' as const,
      relatedEvidence: Object.freeze(evidence),
      possibleSystemGroups: Object.freeze(systemGroups(families)),
      limitations: Object.freeze([
        'The ECU event is evidence that the condition was recorded; it does not establish the mechanical root cause.',
        ...(code === 'P0420' && byCode.has('P0301') ? ['P0301 may contextualize P0420, but AutoPulse does not assert causality from these codes alone.'] : []),
      ]),
      knowledge,
    });
  }));
}
