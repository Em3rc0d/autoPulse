export type DiagnosticTroubleCodeFamily = 'POWERTRAIN' | 'CHASSIS' | 'BODY' | 'NETWORK';
export type DiagnosticTroubleCodeNamespace = 'GENERIC' | 'MANUFACTURER_SPECIFIC' | 'UNKNOWN';
export type DiagnosticTroubleCodeStatus = 'STORED' | 'PENDING' | 'PERMANENT';

export interface DiagnosticMeaningProvenance {
  readonly sourceId: string;
  readonly sourceVersion: string;
}

interface DiagnosticTroubleCodeBase {
  readonly observationId: string;
  readonly code: string;
  readonly family: DiagnosticTroubleCodeFamily;
  readonly namespace: DiagnosticTroubleCodeNamespace;
  readonly status: DiagnosticTroubleCodeStatus;
  /** Null means the response was valid but source ownership was not observable. */
  readonly sourceEndpointId: string | null;
  readonly milRelated?: boolean;
  readonly freezeFrameAvailable?: boolean;
  readonly evidenceIds: readonly string[];
  readonly observedAt: number;
}

type DiagnosticTroubleCodeMeaning =
  | {
      readonly canonicalMeaning: string;
      readonly meaningProvenance: DiagnosticMeaningProvenance;
    }
  | {
      readonly canonicalMeaning?: undefined;
      readonly meaningProvenance?: undefined;
    };

/** Human meaning is optional; when present it is inseparable from provenance. */
export type DiagnosticTroubleCode = DiagnosticTroubleCodeBase & DiagnosticTroubleCodeMeaning;

export function diagnosticTroubleCodeFamily(code: string): DiagnosticTroubleCodeFamily {
  const prefix = code.trim().toUpperCase()[0];
  if (prefix === 'P') return 'POWERTRAIN';
  if (prefix === 'C') return 'CHASSIS';
  if (prefix === 'B') return 'BODY';
  if (prefix === 'U') return 'NETWORK';
  throw new Error(`Unsupported DTC family: ${code}`);
}
