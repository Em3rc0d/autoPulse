import type { DtcServiceParseResult } from '../parsers/DtcServiceParser';
import type { DecodedPidObservation } from './Mode01ValueDecoder';
import { resolveDtcKnowledge, type DtcKnowledgeEntry } from './DtcKnowledgeWallet';
import type { DiagnosticEvidenceFamily } from './PidWallet';

export type DiagnosticEventConfidence = 'CONFIRMED_BY_ECU' | 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';
export type DiagnosticCauseConfidence = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT';

export interface DiagnosticConcernV2 {
  readonly concernId: string;
  readonly code: string;
  readonly sourceEndpointId: string | null;
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

type DtcStatus = 'STORED' | 'PENDING' | 'PERMANENT';

interface ConcernAccumulator {
  readonly code: string;
  readonly sourceEndpointId: string | null;
  readonly statuses: Set<DtcStatus>;
}

function sourceKey(sourceEndpointId: string | null): string {
  return sourceEndpointId ?? 'UNATTRIBUTED';
}

function concernKey(code: string, sourceEndpointId: string | null): string {
  return `${code}::${sourceKey(sourceEndpointId)}`;
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

function evidenceMatchesFamilies(
  observation: DecodedPidObservation,
  families: readonly DiagnosticEvidenceFamily[],
): boolean {
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
}

/**
 * Builds user-facing diagnostic concerns without erasing endpoint provenance.
 *
 * The same DTC observed in stored/pending/permanent state on the same endpoint
 * becomes one concern. The same DTC reported by two attributed endpoints stays
 * as two concerns. PID evidence is eligible only when its endpoint identity is
 * exactly the same as the concern endpoint; UNATTRIBUTED evidence is therefore
 * never silently attached to an attributed ECU (or vice versa).
 */
export function buildDiagnosticConcerns(
  dtcResults: readonly DtcServiceParseResult[],
  pidEvidence: readonly DecodedPidObservation[],
): readonly DiagnosticConcernV2[] {
  const accumulators = new Map<string, ConcernAccumulator>();

  for (const result of dtcResults) {
    if (result.outcome !== 'SUCCESS_WITH_CODES') continue;
    for (const item of result.codes) {
      const key = concernKey(item.code, result.sourceEndpointId);
      const existing = accumulators.get(key);
      if (existing) {
        existing.statuses.add(result.status);
      } else {
        accumulators.set(key, {
          code: item.code,
          sourceEndpointId: result.sourceEndpointId,
          statuses: new Set<DtcStatus>([result.status]),
        });
      }
    }
  }

  return Object.freeze([...accumulators.values()].map(accumulator => {
    const { code, sourceEndpointId, statuses: statusSet } = accumulator;
    const knowledge: DtcKnowledgeEntry = resolveDtcKnowledge(code) ?? fallbackKnowledge(code);
    const families: readonly DiagnosticEvidenceFamily[] = knowledge.concernFamilies;
    const evidence = pidEvidence.filter(observation =>
      observation.sourceEndpointId === sourceEndpointId
      && evidenceMatchesFamilies(observation, families),
    );
    const sameSourceP0301 = accumulators.has(concernKey('P0301', sourceEndpointId));
    const statuses = [...statusSet];

    return Object.freeze({
      concernId: `dtc:${code}:${sourceKey(sourceEndpointId)}`,
      code,
      sourceEndpointId,
      title: knowledge.canonicalMeaning ?? 'Diagnostic trouble code reported',
      statuses: Object.freeze(statuses),
      families: Object.freeze([...families]),
      eventConfidence: 'CONFIRMED_BY_ECU' as const,
      causeConfidence: 'INSUFFICIENT' as const,
      relatedEvidence: Object.freeze(evidence),
      possibleSystemGroups: Object.freeze(systemGroups(families)),
      limitations: Object.freeze([
        'The ECU event is evidence that the condition was recorded; it does not establish the mechanical root cause.',
        ...(sourceEndpointId === null
          ? ['ECU source is unattributed; related PID evidence is contextual and remains unattributed.']
          : []),
        ...(code === 'P0420' && sameSourceP0301
          ? ['P0301 on the same source may contextualize P0420, but AutoPulse does not assert causality from these codes alone.']
          : []),
      ]),
      knowledge,
    });
  }));
}
