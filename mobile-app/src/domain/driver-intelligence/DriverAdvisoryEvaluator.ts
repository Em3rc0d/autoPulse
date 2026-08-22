import type {
  DriverAdvisory,
  VehicleDocumentRecord,
  VehicleHealthState,
} from './models';
import { assessVehicleDocument } from './VehicleDocuments';

const DOCUMENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DTC_COOLDOWN_MS = 5 * 60 * 1000;

export interface DriverIntelligenceInput {
  health: VehicleHealthState;
  documents: readonly VehicleDocumentRecord[];
  nowMs: number;
}

export function evaluateDriverAdvisories(input: DriverIntelligenceInput): DriverAdvisory[] {
  const advisories: DriverAdvisory[] = [];

  for (const dtc of input.health.dtcs) {
    if (dtc.status === 'PENDING') {
      advisories.push({
        id: `dtc:${dtc.status}:${dtc.code}`,
        severity: 'NOTICE',
        title: 'ENGINE CHECK',
        shortMessage: `${dtc.code} pending`,
        voiceMessage: `Possible vehicle fault detected. ${dtc.code} is pending.`,
        confidence: 'MEDIUM',
        evidence: [{ kind: 'DTC', reference: dtc.code, observedValue: dtc.status }],
        startedAt: input.nowMs,
        cooldownMs: DTC_COOLDOWN_MS,
      });
      continue;
    }

    advisories.push({
      id: `dtc:${dtc.status}:${dtc.code}`,
      severity: dtc.status === 'CONFIRMED' ? 'WARNING' : 'NOTICE',
      title: dtc.status === 'CONFIRMED' ? 'ENGINE WARNING' : 'VEHICLE HEALTH',
      shortMessage: dtc.description || `${dtc.code} ${dtc.status.toLowerCase()}`,
      voiceMessage: dtc.description
        ? `${dtc.description}. Diagnostic code ${dtc.code}.`
        : `Diagnostic code ${dtc.code} is ${dtc.status.toLowerCase()}.`,
      confidence: 'HIGH',
      evidence: [{ kind: 'DTC', reference: dtc.code, observedValue: dtc.status }],
      startedAt: input.nowMs,
      cooldownMs: DTC_COOLDOWN_MS,
    });
  }

  for (const document of input.documents) {
    const assessment = assessVehicleDocument(document, input.nowMs);

    if (assessment.status === 'EXPIRED') {
      advisories.push({
        id: `document:${document.type}:expired`,
        severity: 'WARNING',
        title: `${document.type} EXPIRED`,
        shortMessage: 'Renew before driving',
        voiceMessage: `${document.type} has expired.`,
        confidence: document.verifiedByUser ? 'HIGH' : 'MEDIUM',
        evidence: [{ kind: 'DOCUMENT', reference: document.type, observedValue: document.expiresAt }],
        startedAt: input.nowMs,
        cooldownMs: DOCUMENT_COOLDOWN_MS,
      });
    } else if (assessment.status === 'EXPIRES_IMMINENTLY' || assessment.status === 'DUE_SOON') {
      const days = assessment.daysRemaining ?? 0;
      advisories.push({
        id: `document:${document.type}:due`,
        severity: assessment.status === 'EXPIRES_IMMINENTLY' ? 'NOTICE' : 'INFO',
        title: `${document.type} DUE`,
        shortMessage: `${days} day${days === 1 ? '' : 's'} remaining`,
        voiceMessage: `${document.type} expires in ${days} day${days === 1 ? '' : 's'}.`,
        confidence: document.verifiedByUser ? 'HIGH' : 'MEDIUM',
        evidence: [{ kind: 'DOCUMENT', reference: document.type, observedValue: document.expiresAt }],
        startedAt: input.nowMs,
        cooldownMs: DOCUMENT_COOLDOWN_MS,
      });
    }
  }

  return advisories.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(severity: DriverAdvisory['severity']): number {
  switch (severity) {
    case 'CRITICAL': return 4;
    case 'WARNING': return 3;
    case 'NOTICE': return 2;
    case 'INFO': return 1;
  }
}
