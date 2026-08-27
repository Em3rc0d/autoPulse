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
  EvidenceOrigin,
  EvidenceState,
  EvaluationState,
} from '../../../domain/evaluation/models/enums';
import {
  createEvaluationId,
  createEvidenceItemId,
  createManifestId,
  createReportDraftId,
  createReportVersionId,
  createTechnicianId,
  createTenantId,
  createVehicleId,
} from '../../../domain/shared/identifiers';
import { parseUtcIsoTimestamp } from '../../../domain/shared/timestamps';

class EvaluationStore implements CheckReportEvaluationStore {
  check: StoredAutoPulseCheck = {
    purpose: 'PREVENTIVE',
    capabilities: {
      obd: 'SUPPORTED',
      dtcRead: 'SUPPORTED',
      readiness: 'UNKNOWN',
      freezeFrame: 'UNKNOWN',
      liveTelemetry: 'UNKNOWN',
    },
    evaluation: {
      id: createEvaluationId('recovery-eval'),
      tenantId: createTenantId('tenant'),
      vehicleId: createVehicleId('vehicle'),
      technicianId: createTechnicianId('tech'),
      state: EvaluationState.IN_REVIEW,
      scope: {
        description: 'AutoPulse Check · PREVENTIVE',
        requestedItems: [{ id: 'DTC_SCAN', description: 'DTC scan', isMandatory: true }],
      },
      createdAt: parseUtcIsoTimestamp('2026-08-27T13:00:00Z'),
    },
  };

  evidence: EvidenceItem[] = [{
    id: createEvidenceItemId('ev-1'),
    evaluationId: createEvaluationId('recovery-eval'),
    origin: EvidenceOrigin.OBD_CAPTURE,
    type: 'OBD_STORED_DTC_SCAN',
    state: EvidenceState.COMMITTED,
    capturedAt: parseUtcIsoTimestamp('2026-08-27T13:01:00Z'),
    metadata: { executionStatus: 'NO_DATA', diagnosticCodes: [] },
  }];

  async getEvaluation() { return this.check; }
  async saveEvaluation(check: StoredAutoPulseCheck) { this.check = check; }
  async appendEvidence(evidence: EvidenceItem) { this.evidence.push(evidence); }
  async listEvidence() { return [...this.evidence]; }
}

class FindingStore implements CheckReportFindingStore {
  async listFindings(): Promise<Finding[]> { return []; }
}

class ReportStore implements CheckReportStore {
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

const hasher: ReportIntegrityHasher = {
  async sha256Hex(payload: string) {
    let hash = 2166136261;
    for (let index = 0; index < payload.length; index++) {
      hash ^= payload.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  },
};

function idFactory(): CheckReportIdFactory {
  let draft = 0;
  let manifest = 0;
  let version = 0;
  return {
    nextDraftId: () => createReportDraftId(`draft-${++draft}`),
    nextManifestId: () => createManifestId(`manifest-${++manifest}`),
    nextVersionId: () => createReportVersionId(`version-${++version}`),
  };
}

function engine(evaluations: EvaluationStore, reports: ReportStore) {
  return new CheckReportFinalizationEngine(
    evaluations,
    new FindingStore(),
    reports,
    idFactory(),
    hasher,
    () => parseUtcIsoTimestamp('2026-08-27T13:05:00Z'),
  );
}

describe('Check interrupted signature recovery', () => {
  it('promotes READY_FOR_SIGNATURE to SIGNED from the existing verified version after process death', async () => {
    const evaluations = new EvaluationStore();
    const reports = new ReportStore();
    const firstEngine = engine(evaluations, reports);
    const signed = await firstEngine.sign({
      evaluationId: createEvaluationId('recovery-eval'),
      vehicleSnapshot: { make: 'Renault', model: 'Logan', year: 2014 },
    });
    expect(signed.ok).toBe(true);
    if (signed.ok === false) return;

    const originalVersion = signed.value.version;
    const originalManifest = signed.value.manifest;

    // Simulate process death after the durable report version write but before
    // the final evaluation state update reached storage.
    evaluations.check = {
      ...evaluations.check,
      evaluation: {
        ...evaluations.check.evaluation,
        state: EvaluationState.READY_FOR_SIGNATURE,
        signedAt: undefined,
      },
    };

    const restartedEngine = engine(evaluations, reports);
    const recovered = await restartedEngine.reconcileInterruptedSignature(createEvaluationId('recovery-eval'));

    expect(recovered.ok).toBe(true);
    if (recovered.ok === false || !recovered.value) return;
    expect(recovered.value.version.id).toBe(originalVersion.id);
    expect(recovered.value.manifest.id).toBe(originalManifest.id);
    expect(recovered.value.integrityVerified).toBe(true);
    expect(evaluations.check.evaluation.state).toBe(EvaluationState.SIGNED);
    expect(evaluations.check.evaluation.signedAt).toBe(originalVersion.signedAt);
    expect(reports.versions).toHaveLength(1);
  });

  it('refuses recovery when the durable canonical payload was modified', async () => {
    const evaluations = new EvaluationStore();
    const reports = new ReportStore();
    const firstEngine = engine(evaluations, reports);
    const signed = await firstEngine.sign({
      evaluationId: createEvaluationId('recovery-eval'),
      vehicleSnapshot: { make: 'Renault', model: 'Logan', year: 2014 },
    });
    expect(signed.ok).toBe(true);
    if (signed.ok === false) return;

    evaluations.check = {
      ...evaluations.check,
      evaluation: {
        ...evaluations.check.evaluation,
        state: EvaluationState.READY_FOR_SIGNATURE,
        signedAt: undefined,
      },
    };
    const stored = reports.manifests.get(signed.value.manifest.id)!;
    reports.manifests.set(signed.value.manifest.id, {
      ...stored,
      canonicalPayload: `${stored.canonicalPayload}:tampered`,
    });

    const recovered = await engine(evaluations, reports)
      .reconcileInterruptedSignature(createEvaluationId('recovery-eval'));

    expect(recovered.ok).toBe(false);
    if (recovered.ok === true) return;
    expect(recovered.error.code).toBe('CHECK_SIGNATURE_RECOVERY_INTEGRITY_FAILED');
    expect(evaluations.check.evaluation.state).toBe(EvaluationState.READY_FOR_SIGNATURE);
    expect(reports.versions).toHaveLength(1);
  });
});
