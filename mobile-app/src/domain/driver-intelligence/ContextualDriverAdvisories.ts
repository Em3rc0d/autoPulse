import type { DriverAdvisory, SignalOrigin, SignalQuality } from './models';

export interface DriverSignalEvidence {
  signalId: string;
  value: number;
  quality: SignalQuality;
  origin: SignalOrigin;
  unit?: string;
}

export type DriverSignalEvidenceMap = Record<string, DriverSignalEvidence | undefined>;

const usable = (signal?: DriverSignalEvidence) =>
  Boolean(signal && (signal.quality === 'VALID' || signal.quality === 'DEGRADED'));

export function evaluateContextualDriverAdvisories(
  signals: DriverSignalEvidenceMap,
  nowMs: number,
): DriverAdvisory[] {
  const advisories: DriverAdvisory[] = [];
  const rpm = signals.ENGINE_RPM;
  const coolant = signals.ENGINE_COOLANT;
  const voltage = signals.CONTROL_VOLTAGE;

  if (usable(coolant) && coolant!.value >= 116) {
    advisories.push({
      id: 'context:coolant:critical',
      severity: 'CRITICAL',
      title: 'ENGINE TEMPERATURE',
      shortMessage: 'Coolant temperature very high',
      voiceMessage: 'Engine coolant temperature is very high. Reduce load and stop safely if temperature continues rising.',
      confidence: 'MEDIUM',
      evidence: [{
        kind: 'SIGNAL', reference: 'ENGINE_COOLANT', observedValue: coolant!.value,
        origin: coolant!.origin, quality: coolant!.quality,
      }],
      startedAt: nowMs,
      cooldownMs: 60_000,
    });
  } else if (usable(coolant) && coolant!.value >= 106) {
    advisories.push({
      id: 'context:coolant:elevated',
      severity: 'NOTICE',
      title: 'THERMAL LOAD',
      shortMessage: 'Coolant temperature elevated',
      voiceMessage: 'Coolant temperature is elevated.',
      confidence: 'MEDIUM',
      evidence: [{
        kind: 'SIGNAL', reference: 'ENGINE_COOLANT', observedValue: coolant!.value,
        origin: coolant!.origin, quality: coolant!.quality,
      }],
      startedAt: nowMs,
      cooldownMs: 120_000,
    });
  }

  // Generic warm-up guidance: this is deliberately conservative and does not
  // claim engine damage. OEM-specific limits can replace it when proven.
  if (usable(rpm) && usable(coolant) && coolant!.value < 70 && rpm!.value >= 3000) {
    advisories.push({
      id: 'context:cold-engine:high-rpm',
      severity: 'WARNING',
      title: 'ENGINE WARM-UP',
      shortMessage: 'Reduce RPM while engine is cold',
      voiceMessage: 'Engine is still cold. Reduce RPM until it warms up.',
      confidence: 'MEDIUM',
      evidence: [
        { kind: 'SIGNAL', reference: 'ENGINE_COOLANT', observedValue: coolant!.value, origin: coolant!.origin, quality: coolant!.quality },
        { kind: 'SIGNAL', reference: 'ENGINE_RPM', observedValue: rpm!.value, origin: rpm!.origin, quality: rpm!.quality },
      ],
      startedAt: nowMs,
      cooldownMs: 60_000,
    });
  }

  // Charging voltage varies by vehicle strategy, so generic evidence remains a
  // visual notice rather than a spoken alarm unless an OEM profile proves more.
  if (usable(rpm) && usable(voltage) && rpm!.value > 0 && voltage!.value < 13.2) {
    advisories.push({
      id: 'context:charging:low',
      severity: 'NOTICE',
      title: 'CHARGING SYSTEM',
      shortMessage: 'Charging voltage lower than generic reference',
      confidence: 'LOW',
      evidence: [
        { kind: 'SIGNAL', reference: 'CONTROL_VOLTAGE', observedValue: voltage!.value, origin: voltage!.origin, quality: voltage!.quality },
        { kind: 'SIGNAL', reference: 'ENGINE_RPM', observedValue: rpm!.value, origin: rpm!.origin, quality: rpm!.quality },
      ],
      startedAt: nowMs,
      cooldownMs: 180_000,
    });
  }

  const rank = (severity: DriverAdvisory['severity']) => ({ CRITICAL: 4, WARNING: 3, NOTICE: 2, INFO: 1 }[severity]);
  return advisories.sort((a, b) => rank(b.severity) - rank(a.severity));
}
