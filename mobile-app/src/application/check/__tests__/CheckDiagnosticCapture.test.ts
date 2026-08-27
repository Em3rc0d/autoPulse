import {
  DiagnosticConnector,
  DiagnosticRequest,
  DiagnosticResponse,
} from '../../../domain/diagnostics/DiagnosticConnector';
import { EvidenceState, EvaluationState } from '../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';
import { captureCheckDiagnosticEvidence } from '../CheckDiagnosticCapture';

class FakeConnector implements DiagnosticConnector {
  requests: DiagnosticRequest[] = [];

  constructor(private readonly responseFor: (request: DiagnosticRequest) => DiagnosticResponse) {}

  async connect() {}
  async disconnect() {}
  async identify() { return { transport: 'BLE' as const, family: 'ELM327_COMPATIBLE' as const }; }
  async discoverCapabilities() {
    return {
      requestKinds: ['OBD_STANDARD' as const],
      protocols: ['UNKNOWN' as const],
      supportsAutomaticProtocolDiscovery: true,
      supportsRawDiagnosticRequests: true,
      supportsMultipleEcus: true,
    };
  }
  async execute(request: DiagnosticRequest) {
    this.requests.push(request);
    return this.responseFor(request);
  }
  health() { return { connected: true, reliability: 'GOOD' as const }; }
}

const inputBase = {
  evidenceId: createEvidenceItemId('evidence-1'),
  evaluationId: createEvaluationId('evaluation-1'),
  evaluationState: EvaluationState.EVIDENCE_COLLECTION,
  capturedAt: parseUtcIsoTimestamp('2026-08-26T20:00:00Z'),
} as const;

function response(request: DiagnosticRequest, patch: Partial<DiagnosticResponse> = {}): DiagnosticResponse {
  return {
    request,
    status: 'SUCCESS',
    decodedValues: [],
    sourceEcus: ['7E8'],
    latencyMs: 40,
    errors: [],
    ...patch,
  };
}

describe('CheckDiagnosticCapture', () => {
  it('reads stored DTCs with Mode 03 and records the codes without any write operation', async () => {
    const connector = new FakeConnector(request => response(request, { diagnosticCodes: ['P0302'] }));
    const result = await captureCheckDiagnosticEvidence(connector, { ...inputBase, kind: 'STORED_DTC' });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw result.error;
    expect(connector.requests[0]).toMatchObject({ payload: '03', expectedService: '43', kind: 'OBD_STANDARD' });
    expect(result.value.evidence.state).toBe(EvidenceState.COMMITTED);
    expect(result.value.evidence.metadata).toMatchObject({
      diagnosticCodes: ['P0302'],
      vehicleWritePerformed: false,
      coverage: 'STANDARD_OBD_STORED_DTC_SERVICE',
    });
  });

  it('captures PID 01 monitor summary but explicitly does not claim detailed readiness decoding', async () => {
    const connector = new FakeConnector(request => response(request, {
      monitorStatus: { milOn: false, confirmedDtcCount: 0 },
    }));
    const result = await captureCheckDiagnosticEvidence(connector, { ...inputBase, kind: 'READINESS' });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw result.error;
    expect(connector.requests[0]).toMatchObject({ payload: '0101', expectedService: '41', expectedPid: '01' });
    expect(result.value.evidence.metadata).toMatchObject({
      monitorStatus: { milOn: false, confirmedDtcCount: 0 },
      detailedMonitorBreakdownDecoded: false,
      coverage: 'PARTIAL_MONITOR_SUMMARY',
    });
  });

  it('probes only the freeze-frame trigger DTC and does not claim a full freeze frame', async () => {
    const connector = new FakeConnector(request => response(request, {
      freezeFrameTrigger: { frameNumber: 0, triggerDtc: 'P0123', sourceEcu: '7E8' },
    }));
    const result = await captureCheckDiagnosticEvidence(connector, { ...inputBase, kind: 'FREEZE_FRAME_TRIGGER' });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw result.error;
    expect(connector.requests[0]).toMatchObject({ payload: '020200', expectedService: '42', expectedPid: '02' });
    expect(result.value.evidence.metadata).toMatchObject({
      fullFreezeFrameCaptured: false,
      freezeFrameTrigger: { frameNumber: 0, triggerDtc: 'P0123' },
      coverage: 'TRIGGER_DTC_PROBE_ONLY',
    });
  });

  it('commits NO_DATA as an attempted observation without converting it to PASS', async () => {
    const connector = new FakeConnector(request => response(request, { status: 'NO_DATA' }));
    const result = await captureCheckDiagnosticEvidence(connector, { ...inputBase, kind: 'STORED_DTC' });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw result.error;
    expect(result.value.evidence.state).toBe(EvidenceState.COMMITTED);
    expect(result.value.evidence.metadata?.executionStatus).toBe('NO_DATA');
  });

  it('marks transport failure evidence FAILED rather than inventing a diagnostic result', async () => {
    const connector = new FakeConnector(request => response(request, { status: 'TIMEOUT' }));
    const result = await captureCheckDiagnosticEvidence(connector, { ...inputBase, kind: 'READINESS' });

    expect(result.ok).toBe(true);
    if (result.ok === false) throw result.error;
    expect(result.value.evidence.state).toBe(EvidenceState.FAILED);
    expect(result.value.evidence.metadata?.executionStatus).toBe('TIMEOUT');
  });

  it('rejects diagnostic evidence capture after the evaluation is signed', async () => {
    const connector = new FakeConnector(request => response(request));
    const result = await captureCheckDiagnosticEvidence(connector, {
      ...inputBase,
      evaluationState: EvaluationState.SIGNED,
      kind: 'STORED_DTC',
    });

    expect(result.ok).toBe(false);
    expect(connector.requests).toHaveLength(0);
  });
});
