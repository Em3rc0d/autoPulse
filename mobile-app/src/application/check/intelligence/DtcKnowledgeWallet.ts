import type { DiagnosticEvidenceFamily } from './PidWallet';

export type DtcKnowledgeNamespace = 'GENERIC' | 'MANUFACTURER_SPECIFIC' | 'UNKNOWN';
export type DtcKnowledgeFamily = 'POWERTRAIN' | 'CHASSIS' | 'BODY' | 'NETWORK';

export interface DtcKnowledgeEntry {
  readonly code: string;
  readonly family: DtcKnowledgeFamily;
  readonly namespace: DtcKnowledgeNamespace;
  readonly canonicalMeaning?: string;
  readonly concernFamilies: readonly DiagnosticEvidenceFamily[];
  readonly provenance: string;
}

const KNOWN: Readonly<Record<string, { meaning: string; families: readonly DiagnosticEvidenceFamily[] }>> = Object.freeze({
  P0100: { meaning: 'Mass or Volume Air Flow Circuit Malfunction', families: ['AIR_METERING','AIR_FUEL'] },
  P0101: { meaning: 'Mass or Volume Air Flow Circuit Range/Performance Problem', families: ['AIR_METERING','AIR_FUEL'] },
  P0102: { meaning: 'Mass or Volume Air Flow Circuit Low Input', families: ['AIR_METERING','AIR_FUEL'] },
  P0103: { meaning: 'Mass or Volume Air Flow Circuit High Input', families: ['AIR_METERING','AIR_FUEL'] },
  P0115: { meaning: 'Engine Coolant Temperature Circuit Malfunction', families: ['COOLING'] },
  P0116: { meaning: 'Engine Coolant Temperature Circuit Range/Performance Problem', families: ['COOLING'] },
  P0117: { meaning: 'Engine Coolant Temperature Circuit Low Input', families: ['COOLING'] },
  P0118: { meaning: 'Engine Coolant Temperature Circuit High Input', families: ['COOLING'] },
  P0128: { meaning: 'Coolant Thermostat Temperature Below Regulating Temperature', families: ['COOLING'] },
  P0130: { meaning: 'Oxygen Sensor Circuit Malfunction Bank 1 Sensor 1', families: ['O2_SENSOR','AIR_FUEL'] },
  P0133: { meaning: 'Oxygen Sensor Circuit Slow Response Bank 1 Sensor 1', families: ['O2_SENSOR','AIR_FUEL','CATALYST'] },
  P0136: { meaning: 'Oxygen Sensor Circuit Malfunction Bank 1 Sensor 2', families: ['O2_SENSOR','CATALYST'] },
  P0171: { meaning: 'System Too Lean Bank 1', families: ['AIR_FUEL','FUEL_DELIVERY','AIR_METERING'] },
  P0172: { meaning: 'System Too Rich Bank 1', families: ['AIR_FUEL','FUEL_DELIVERY','AIR_METERING'] },
  P0174: { meaning: 'System Too Lean Bank 2', families: ['AIR_FUEL','FUEL_DELIVERY','AIR_METERING'] },
  P0175: { meaning: 'System Too Rich Bank 2', families: ['AIR_FUEL','FUEL_DELIVERY','AIR_METERING'] },
  P0300: { meaning: 'Random/Multiple Cylinder Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0301: { meaning: 'Cylinder 1 Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0302: { meaning: 'Cylinder 2 Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0303: { meaning: 'Cylinder 3 Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0304: { meaning: 'Cylinder 4 Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0305: { meaning: 'Cylinder 5 Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0306: { meaning: 'Cylinder 6 Misfire Detected', families: ['COMBUSTION','AIR_FUEL','FUEL_DELIVERY'] },
  P0401: { meaning: 'Exhaust Gas Recirculation Flow Insufficient Detected', families: ['EGR','AIR_METERING'] },
  P0402: { meaning: 'Exhaust Gas Recirculation Flow Excessive Detected', families: ['EGR','AIR_METERING'] },
  P0420: { meaning: 'Catalyst System Efficiency Below Threshold Bank 1', families: ['CATALYST','O2_SENSOR'] },
  P0430: { meaning: 'Catalyst System Efficiency Below Threshold Bank 2', families: ['CATALYST','O2_SENSOR'] },
  P0440: { meaning: 'Evaporative Emission Control System Malfunction', families: ['EVAP'] },
  P0442: { meaning: 'Evaporative Emission Control System Leak Detected (small leak)', families: ['EVAP'] },
  P0455: { meaning: 'Evaporative Emission Control System Leak Detected (gross leak)', families: ['EVAP'] },
  P0500: { meaning: 'Vehicle Speed Sensor Malfunction', families: ['CONTEXT'] },
});

function familyOf(code: string): DtcKnowledgeFamily {
  switch (code[0]) {
    case 'P': return 'POWERTRAIN';
    case 'C': return 'CHASSIS';
    case 'B': return 'BODY';
    case 'U': return 'NETWORK';
    default: return 'POWERTRAIN';
  }
}

function namespaceOf(code: string): DtcKnowledgeNamespace {
  const second = code[1];
  if (second === '0' || second === '2') return 'GENERIC';
  if (second === '1' || second === '3') return 'MANUFACTURER_SPECIFIC';
  return 'UNKNOWN';
}

export function isSyntacticallyValidDtc(code: string): boolean {
  return /^[PBCU][0-3][0-9A-F]{3}$/.test(code.trim().toUpperCase());
}

export function resolveDtcKnowledge(code: string): DtcKnowledgeEntry | undefined {
  const normalized = code.trim().toUpperCase();
  if (!isSyntacticallyValidDtc(normalized)) return undefined;
  const known = KNOWN[normalized];
  return Object.freeze({
    code: normalized,
    family: familyOf(normalized),
    namespace: namespaceOf(normalized),
    ...(known ? { canonicalMeaning: known.meaning } : {}),
    concernFamilies: Object.freeze([...(known?.families ?? ['CONTEXT' as const])]),
    provenance: known
      ? 'CHECK v4 curated generic OBD-II DTC knowledge; meaning layer is distinct from ECU event evidence'
      : 'Valid DTC syntax retained even when AutoPulse has no promoted canonical meaning',
  });
}
