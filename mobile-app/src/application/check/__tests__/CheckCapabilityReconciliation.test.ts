import { EvidenceOrigin, EvidenceState } from '../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';
import {
  capabilityPatchFromDiagnosticEvidence,
  capabilityPatchFromDiscovery,
  mergeCheckCapabilities,
} from '../CheckCapabilityReconciliation';

const baseCapabilities = {
  obd: 'UNKNOWN' as const,
  dtcRead: 'UNKNOWN' as const,
  readiness: 'UNKNOWN' as const,
  freezeFrame: 'UNKNOWN' as const,
  liveTelemetry: 'UNKNOWN' as const,
  availableSignals: [] as string[],
};

const evidence = (type: string, metadata: Record<string, unknown>) => ({
  id: createEvidenceItemId(`evidence-${type}`),
  evaluationId: createEvaluationId('evaluation-1'),
  origin: EvidenceOrigin.OBD_CAPTURE,
  type,
  state: EvidenceState.COMMITTED,
  capturedAt: parseUtcIsoTimestamp('2026-08-27T10:00:00Z'),
  metadata,
});

describe('CheckCapabilityReconciliation', () => {
  it('promotes only successful capability discovery to OBD/live support', () => {
    expect(capabilityPatchFromDiscovery({
      initializationSuccessful: true,
      supportedPids: ['010C', '0105'],
    })).toEqual({
      obd: 'SUPPORTED',
      liveTelemetry: 'SUPPORTED',
      availableSignals: ['010C', '0105'],
    });

    expect(capabilityPatchFromDiscovery({
      initializationSuccessful: false,
      supportedPids: [],
      failureReason: 'TIMEOUT',
    })).toEqual({});
  });

  it('treats a NO_DATA stored-DTC response as service support, not as a healthy vehicle claim', () => {
    const patch = capabilityPatchFromDiagnosticEvidence(evidence('OBD_STORED_DTC_SCAN', {
      executionStatus: 'NO_DATA',
      diagnosticCodes: [],
    }));
    expect(patch).toEqual({ dtcRead: 'SUPPORTED' });
  });

  it('requires an actual monitor-status payload before readiness becomes supported', () => {
    expect(capabilityPatchFromDiagnosticEvidence(evidence('OBD_MONITOR_STATUS_PID01', {
      executionStatus: 'SUCCESS',
      monitorStatus: null,
    }))).toEqual({});

    expect(capabilityPatchFromDiagnosticEvidence(evidence('OBD_MONITOR_STATUS_PID01', {
      executionStatus: 'SUCCESS',
      monitorStatus: { milOn: false, confirmedDtcCount: 0 },
    }))).toEqual({ readiness: 'SUPPORTED' });
  });

  it('does not downgrade proven support back to UNKNOWN', () => {
    const merged = mergeCheckCapabilities({
      ...baseCapabilities,
      obd: 'SUPPORTED',
      availableSignals: ['010C'],
    }, {
      obd: 'UNKNOWN',
      availableSignals: ['0105'],
    });

    expect(merged.obd).toBe('SUPPORTED');
    expect(merged.availableSignals).toEqual(['010C', '0105']);
  });
});
