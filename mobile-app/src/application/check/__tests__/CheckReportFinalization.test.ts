import {
  CheckReportEvaluationStore,
  CheckReportFindingStore,
  CheckReportFinalizationEngine,
  CheckReportIdFactory,
  CheckReportStore,
  StoredCheckManifest,
} from '../CheckReportFinalization';
import { ReportIntegrityHasher } from '../CheckReportIntegrity';
import { StoredAutoPulseCheck } from '../AutoPulseCheckEngine';
import { EvidenceItem } from '../../../domain/evaluation/models/evidenceItem';
import { Finding } from '../../../domain/evaluation/models/finding';
import { ReportDraft } from '../../../domain/evaluation/models/reportDraft';
import { ReportManifest } from '../../../domain/evaluation/models/reportManifest';
import { ReportVersion } from '../../../domain/evaluation/models/reportVersion';
import {
  ConfidenceLevel,
  EvidenceOrigin,
  EvidenceState,
  EvaluationState,
  FindingSeverity,
  FindingSource,
  FindingStatus,
} from '../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
  createFindingId,
  createManifestId,
  createReportDraftId,
  createReportVersionId,
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';

class MemoryEvaluationStore implements CheckReportEvaluationStore {
  check: StoredAutoPulseCheck;
  evidence: EvidenceItem[] = [];

  constructor() {
    this.check = {
      purpose: 'PREVENTIVE',
      capabilities: {
        obd: 'SUPPORTED',
        dtcRead: 'SUPPORTED',
        readiness: 'UNKNOWN',
        freezeFrame: 'UNKNOWN',
        liveTelemetry: 'UNKNOWN',
      },
      evaluation: {
        id: createEvaluationId('eval-1'),
        tenantId: createTenantId('tenant-1'),
        vehicleId: createVehicleId('vehicle-1'),
        technicianId: createTechnicianId('tech-1'),
        state: EvaluationState.IN_REVIEW,
        scope: {
          description: 'AutoPulse Check · PREVENTIVE',
          requestedItems: [{ id: 'DTC_SCAN', description: 'Read diagnostic trouble codes', isMandatory: true }],
        },
        createdAt: parseUtcIsoTimestamp('2026-08-27T12:00:00Z'),
      },
    };
  }

  async getEvaluation() { return this.check; }
  async saveEvaluation(check: StoredAutoPulseCheck) { this.check = check; }
  async appendEvidence(evidence: EvidenceItem) { this.evidence.push(evidence); }
  async listEvidence() { return [...this.evidence]; }
}

class MemoryFindingStore implements CheckReportFindingStore {
  findings: Finding[] = [];
  async listFindings() { return [...this.findings]; }
}

class MemoryReportStore implements CheckReportStore {
  draft: ReportDraft | null = null;
  manifests = new Map<string, StoredCheckManifest>();
  versions: ReportVersion[] = [];

  async saveDraft(draft: ReportDraft) { this.draft = draft; }
  async getLatestDraft() { return this.draft; }
  async saveManifest(_evaluationId: string, manifest: ReportManifest, canonicalPayload: string, integrityHash: string) {
    this.manifests.set(manifest.id, { manifest, canonicalPayload, integrityHash });
  }
  async getManifest(id: any) { return this.manifests.get(id) ?? null; }
  async saveVersion(version: ReportVersion) { this.versions.push(version); }
  async getLatestVersion() { return this.versions[this.versions.length - 1] ?? null; }
}

const deterministicHasher: ReportIntegrityHasher = {
  async sha256Hex(payload: string) {
    // Deterministic test double: integrity semantics are tested without native Expo crypto.
    return `hash:${payload.length}:${payload.charCodeAt(0) || 0}`;
  },
};

function ids(): CheckReportIdFactory {
  let draft = 0;
  let manifest = 0;
  let version = 0;
  return {
    nextDraftId: () => createReportDraftId(`draft-${++draft}`),
    nextManifestId: () => createManifestId(`manifest-${++manifest}`),
    nextVersionId: () => createReportVersionId(`version-${++version}`),
  };
}

function committedDtcEvidence(): EvidenceItem {
  return {
    id: createEvidenceItemId('evidence-dtc'),
    evaluationId: createEvaluationId('eval-1'),
    origin: EvidenceOrigin.OBD_CAPTURE,
    type: 'OBD_STORED_DTC_SCAN',
    state: EvidenceState.COMMITTED,
    capturedAt: parseUtcIsoTimestamp('2026-08-27T12:01:00Z'),
    metadata: { executionStatus: 'NO_DATA', diagnosticCodes: [] },
  };
}

function createEngine(evaluations: MemoryEvaluationStore, findings: MemoryFindingStore, reports: MemoryReportStore) {
  return new CheckReportFinalizationEngine(
    evaluations,
    findings,
    reports,
    ids(),
    deterministicHasher,
    () => parseUtcIsoTimestamp('2026-08-27T12:05:00Z'),
  );
}

describe('CheckReportFinalizationEngine', () => {
  it('signs a limited/partial evidence-bound report without converting NO_DATA into a healthy claim', async () => {
    const evaluations = new MemoryEvaluationStore();
    const findings = new MemoryFindingStore();
    const reports = new MemoryReportStore();
    evaluations.evidence = [committedDtcEvidence()];

    const result = await createEngine(evaluations, findings, reports).sign({
      evaluationId: createEvaluationId('eval-1'),
      vehicleSnapshot: { make: 'Renault', model: 'Logan', year: 2014 },
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.value.evaluation.evaluation.state).toBe(EvaluationState.SIGNED);
    expect(result.value.manifest.selectedEvidence).toHaveLength(1);
    expect(result.value.manifest.findings).toHaveLength(0);
    expect(result.value.manifest.limitations).toContain('limited to the documented evaluation scope');
    expect(result.value.integrityVerified).toBe(true);
    expect(result.value.version.versionNumber).toBe(1);
  });

  it('refuses signing while a system finding remains PROPOSED', async () => {
    const evaluations = new MemoryEvaluationStore();
    const findings = new MemoryFindingStore();
    const reports = new MemoryReportStore();
    evaluations.evidence = [committedDtcEvidence()];
    findings.findings = [{
      id: createFindingId('finding-1'),
      evaluationId: createEvaluationId('eval-1'),
      source: FindingSource.SYSTEM_RULE,
      status: FindingStatus.PROPOSED,
      severity: FindingSeverity.ATENCION_REQUERIDA,
      confidence: ConfidenceLevel.HIGH,
      evidenceIds: [createEvidenceItemId('evidence-dtc')],
    }];

    const result = await createEngine(evaluations, findings, reports).sign({
      evaluationId: createEvaluationId('eval-1'),
      vehicleSnapshot: { make: 'Renault', model: 'Logan', year: 2014 },
    });

    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.error.code).toBe('CHECK_UNRESOLVED_FINDINGS');
    expect(reports.versions).toHaveLength(0);
  });

  it('reopens the same immutable report version instead of generating another one', async () => {
    const evaluations = new MemoryEvaluationStore();
    const findings = new MemoryFindingStore();
    const reports = new MemoryReportStore();
    evaluations.evidence = [committedDtcEvidence()];
    const engine = createEngine(evaluations, findings, reports);

    const first = await engine.sign({
      evaluationId: createEvaluationId('eval-1'),
      vehicleSnapshot: { make: 'Renault', model: 'Logan', year: 2014 },
    });
    expect(first.ok).toBe(true);

    const second = await engine.sign({
      evaluationId: createEvaluationId('eval-1'),
      vehicleSnapshot: { make: 'IGNORED AFTER SIGNATURE' },
    });
    expect(second.ok).toBe(true);
    if (first.ok === false || second.ok === false) return;
    expect(second.value.version.id).toBe(first.value.version.id);
    expect(second.value.manifest.id).toBe(first.value.manifest.id);
    expect(reports.versions).toHaveLength(1);
  });

  it('detects stored canonical-payload tampering on reopen verification', async () => {
    const evaluations = new MemoryEvaluationStore();
    const findings = new MemoryFindingStore();
    const reports = new MemoryReportStore();
    evaluations.evidence = [committedDtcEvidence()];
    const engine = createEngine(evaluations, findings, reports);

    const first = await engine.sign({
      evaluationId: createEvaluationId('eval-1'),
      vehicleSnapshot: { make: 'Renault', model: 'Logan', year: 2014 },
    });
    expect(first.ok).toBe(true);
    if (first.ok === false) return;

    const stored = reports.manifests.get(first.value.manifest.id)!;
    reports.manifests.set(first.value.manifest.id, {
      ...stored,
      canonicalPayload: `${stored.canonicalPayload}tampered`,
    });

    const verified = await engine.verifyStoredVersion(createEvaluationId('eval-1'));
    expect(verified.ok).toBe(true);
    if (verified.ok === false) return;
    expect(verified.value.integrityVerified).toBe(false);
  });
});
