import type { DiagnosticProtocol } from '../diagnostics/DiagnosticConnector';
import type { DiagnosticEndpoint } from './DiagnosticEndpoint';
import type { DiagnosticEvidenceFact, DiagnosticEvidenceRelation } from './DiagnosticEvidence';
import type { DiagnosticFreezeFrame } from './DiagnosticFreezeFrame';
import type { DiagnosticMonitorResult } from './DiagnosticMonitorResult';
import type { DiagnosticReadiness } from './DiagnosticReadiness';
import type { DiagnosticScanState } from './DiagnosticScanState';
import type { DiagnosticTroubleCode } from './DiagnosticTroubleCode';

export interface DiagnosticScan {
  readonly scanId: string;
  readonly vehicleId?: string;
  readonly state: DiagnosticScanState;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly protocol: DiagnosticProtocol;
  readonly endpointAttribution: 'ATTRIBUTED' | 'PARTIAL' | 'UNATTRIBUTED';
  readonly endpoints: readonly DiagnosticEndpoint[];
  readonly troubleCodes: readonly DiagnosticTroubleCode[];
  readonly readiness: readonly DiagnosticReadiness[];
  readonly freezeFrames: readonly DiagnosticFreezeFrame[];
  readonly monitorResults: readonly DiagnosticMonitorResult[];
  readonly evidenceFacts: readonly DiagnosticEvidenceFact[];
  readonly evidenceRelations: readonly DiagnosticEvidenceRelation[];
  readonly limitations: readonly string[];
}
