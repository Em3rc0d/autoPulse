import { AutoPulseCheckStore, StoredAutoPulseCheck } from './AutoPulseCheckEngine';
import { assessCheckCoverage } from './CheckCoverageAssessment';
import { canonicalizeReportPayload, ReportIntegrityHasher, verifyReportIntegrity } from './CheckReportIntegrity';
import { validateSignatureRequirements } from '../../domain/evaluation/logic/signaturePolicy';
import { canTransitionEvaluation } from '../../domain/evaluation/logic/evaluationStateMachine';
import { canTransitionReportDraft } from '../../domain/evaluation/logic/reportDraftStateMachine';
import { EvidenceItem } from '../../domain/evaluation/models/evidenceItem';
import { Finding } from '../../domain/evaluation/models/finding';
import { ReportDraft } from '../../domain/evaluation/models/reportDraft';
import { ReportManifest } from '../../domain/evaluation/models/reportManifest';
import { ReportVersion } from '../../domain/evaluation/models/reportVersion';
import { VehicleSnapshot } from '../../domain/evaluation/models/vehicleSnapshot';
import {
  EvaluationState,
  EvidenceState,
  FindingStatus,
  ReportDraftState,
  ReportVersionState,
} from '../../domain/evaluation/models/enums';
import {
  EvaluationId,
  ManifestId,
  ReportDraftId,
  ReportVersionId,
} from '../../domain/shared/identifiers';
import { UtcIsoTimestamp } from '../../domain/shared/timestamps';
import { STANDARD_OBD_CATALOG_VERSION } from '../../domain/obd/StandardObdCatalogV1';
import { DomainError } from '../../domain/shared/domainError';
import { Result, failure, success } from '../../domain/shared/result';

const CHECK_ENGINE_VERSION = 'AUTOPULSE_CHECK_MVP_1';
const STANDARD_LIMITATION = 'This report is limited to the documented evaluation scope and evidence actually captured. Systems outside that scope were not evaluated.';

export interface CheckReportEvaluationStore extends AutoPulseCheckStore {
  listEvidence(evaluationId: string): Promise<EvidenceItem[]>;
}

export interface CheckReportFindingStore {
  listFindings(evaluationId: string): Promise<Finding[]>;
}

export interface StoredCheckManifest {
  readonly manifest: ReportManifest;
  readonly canonicalPayload: string;
  readonly integrityHash: string;
}

export interface CheckReportStore {
  saveDraft(draft: ReportDraft): Promise<void>;
  getLatestDraft(evaluationId: string): Promise<ReportDraft | null>;
  saveManifest(evaluationId: string, manifest: ReportManifest, canonicalPayload: string, integrityHash: string): Promise<void>;
  getManifest(id: ManifestId): Promise<StoredCheckManifest | null>;
  saveVersion(version: ReportVersion): Promise<void>;
  getLatestVersion(evaluationId: string): Promise<ReportVersion | null>;
}

export interface CheckReportIdFactory {
  nextDraftId(): ReportDraftId;
  nextManifestId(): ManifestId;
  nextVersionId(): ReportVersionId;
}

export interface SignCheckReportInput {
  readonly evaluationId: EvaluationId;
  readonly vehicleSnapshot: VehicleSnapshot;
  readonly recommendations?: string;
}

export interface SignedCheckReport {
  readonly evaluation: StoredAutoPulseCheck;
  readonly manifest: ReportManifest;
  readonly version: ReportVersion;
  readonly integrityVerified: boolean;
}

function reportError(code: string, message: string, context?: Record<string, unknown>): DomainError {
  return { code, message, context };
}

function mergeLimitations(...groups: Array<readonly string[] | undefined>): string {
  const values = groups.flatMap(group => group ?? []).map(value => value.trim()).filter(Boolean);
  values.push(STANDARD_LIMITATION);
  return Array.from(new Set(values)).join(' ');
}

function protocolFromEvidence(evidence: readonly EvidenceItem[]): string | undefined {
  const capability = evidence.find(item => item.type === 'OBD_CAPABILITY_DISCOVERY' && item.state === EvidenceState.COMMITTED);
  const protocol = capability?.metadata?.protocol;
  return typeof protocol === 'string' && protocol.trim() && protocol !== 'UNKNOWN' ? protocol : undefined;
}

export class CheckReportFinalizationEngine {
  constructor(
    private readonly evaluations: CheckReportEvaluationStore,
    private readonly findings: CheckReportFindingStore,
    private readonly reports: CheckReportStore,
    private readonly ids: CheckReportIdFactory,
    private readonly hasher: ReportIntegrityHasher,
    private readonly now: () => UtcIsoTimestamp,
  ) {}

  async assessAndPersistCoverage(evaluationId: EvaluationId): Promise<Result<StoredAutoPulseCheck, DomainError>> {
    const check = await this.evaluations.getEvaluation(evaluationId);
    if (!check) return failure(reportError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', { evaluationId }));
    if ([EvaluationState.SIGNED, EvaluationState.DELIVERED, EvaluationState.CANCELLED].includes(check.evaluation.state)) {
      return failure(reportError('CHECK_COVERAGE_IMMUTABLE', 'Coverage cannot be recalculated after finalization.', { state: check.evaluation.state }));
    }

    const evidence = await this.evaluations.listEvidence(evaluationId);
    const assessed = assessCheckCoverage(check, evidence, this.now());
    const evaluation = {
      ...check.evaluation,
      coverage: assessed.coverage,
      limitations: mergeLimitations(
        check.evaluation.limitations ? [check.evaluation.limitations] : undefined,
        assessed.limitations,
      ),
    };
    const updated = { ...check, evaluation };
    await this.evaluations.saveEvaluation(updated);
    return success(updated);
  }

  async sign(input: SignCheckReportInput): Promise<Result<SignedCheckReport, DomainError>> {
    let check = await this.evaluations.getEvaluation(input.evaluationId);
    if (!check) return failure(reportError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', { evaluationId: input.evaluationId }));

    // Idempotent reopen path: once signed, return the immutable stored version.
    if (check.evaluation.state === EvaluationState.SIGNED || check.evaluation.state === EvaluationState.DELIVERED) {
      const version = await this.reports.getLatestVersion(input.evaluationId);
      if (!version) return failure(reportError('CHECK_SIGNED_VERSION_MISSING', 'Evaluation is signed but its immutable report version is missing.'));
      const stored = await this.reports.getManifest(version.manifestId);
      if (!stored) return failure(reportError('CHECK_SIGNED_MANIFEST_MISSING', 'Signed report manifest could not be reconstructed.'));
      const integrityVerified = await verifyReportIntegrity(stored.canonicalPayload, stored.integrityHash, this.hasher);
      return success({ evaluation: check, manifest: stored.manifest, version, integrityVerified });
    }

    if (check.evaluation.state !== EvaluationState.IN_REVIEW && check.evaluation.state !== EvaluationState.READY_FOR_SIGNATURE) {
      return failure(reportError(
        'CHECK_NOT_READY_FOR_REPORT',
        'Evaluation must be in professional review before it can be prepared for signature.',
        { state: check.evaluation.state },
      ));
    }

    const evidence = await this.evaluations.listEvidence(input.evaluationId);
    const committedEvidence = evidence.filter(item => item.state === EvidenceState.COMMITTED);
    if (committedEvidence.length === 0) {
      return failure(reportError(
        'CHECK_NO_COMMITTED_EVIDENCE',
        'At least one committed evidence item is required before an AutoPulse Check report can be signed.',
      ));
    }

    const findings = await this.findings.listFindings(input.evaluationId);
    const unresolved = findings.filter(item => item.status === FindingStatus.PROPOSED);
    if (unresolved.length > 0) {
      return failure(reportError('CHECK_UNRESOLVED_FINDINGS', 'All proposed findings must be professionally reviewed before signing.', {
        findingIds: unresolved.map(item => item.id),
      }));
    }

    // Coverage is intentionally recalculated at signature time so a stale
    // assessment cannot outlive later evidence changes.
    const coverageResult = await this.assessAndPersistCoverage(input.evaluationId);
    if (coverageResult.ok === false) return failure(coverageResult.error);
    check = coverageResult.value;

    const signatureGate = validateSignatureRequirements(check.evaluation, findings, evidence);
    if (signatureGate.ok === false) return failure(signatureGate.error);

    if (check.evaluation.state === EvaluationState.IN_REVIEW) {
      const allowed = canTransitionEvaluation(EvaluationState.IN_REVIEW, EvaluationState.READY_FOR_SIGNATURE);
      if (allowed.ok === false) return failure(allowed.error);
      check = {
        ...check,
        evaluation: { ...check.evaluation, state: EvaluationState.READY_FOR_SIGNATURE },
      };
      await this.evaluations.saveEvaluation(check);
    }

    const existingDraft = await this.reports.getLatestDraft(input.evaluationId);
    let draft: ReportDraft = existingDraft ?? {
      id: this.ids.nextDraftId(),
      evaluationId: input.evaluationId,
      state: ReportDraftState.DRAFT,
      visibleFindingIds: findings.map(item => item.id),
      selectedEvidenceIds: evidence.map(item => item.id),
      customRecommendations: input.recommendations,
    };
    if (draft.state !== ReportDraftState.READY_FOR_SIGNATURE) {
      const draftGate = canTransitionReportDraft(draft.state, ReportDraftState.READY_FOR_SIGNATURE);
      if (draftGate.ok === false) return failure(draftGate.error);
      draft = {
        ...draft,
        state: ReportDraftState.READY_FOR_SIGNATURE,
        visibleFindingIds: findings.map(item => item.id),
        selectedEvidenceIds: evidence.map(item => item.id),
        customRecommendations: input.recommendations ?? draft.customRecommendations,
      };
      await this.reports.saveDraft(draft);
    }

    const generatedAt = this.now();
    const protocolDetected = input.vehicleSnapshot.protocolDetected ?? protocolFromEvidence(evidence);
    const manifest: ReportManifest = {
      id: this.ids.nextManifestId(),
      vehicleSnapshot: {
        ...input.vehicleSnapshot,
        protocolDetected,
      },
      technicianId: check.evaluation.technicianId,
      scope: check.evaluation.scope,
      coverage: check.evaluation.coverage,
      findings,
      selectedEvidence: evidence,
      limitations: check.evaluation.limitations,
      recommendations: input.recommendations ?? draft.customRecommendations,
      engineVersion: CHECK_ENGINE_VERSION,
      catalogVersion: STANDARD_OBD_CATALOG_VERSION,
      generatedAt,
    };

    const canonicalPayload = canonicalizeReportPayload(manifest);
    const integrityHash = await this.hasher.sha256Hex(canonicalPayload);
    await this.reports.saveManifest(input.evaluationId, manifest, canonicalPayload, integrityHash);

    const previousVersion = await this.reports.getLatestVersion(input.evaluationId);
    const signedAt = this.now();
    const version: ReportVersion = {
      id: this.ids.nextVersionId(),
      evaluationId: input.evaluationId,
      versionNumber: (previousVersion?.versionNumber ?? 0) + 1,
      state: ReportVersionState.SIGNED,
      manifestId: manifest.id,
      integrityHash,
      signedBy: check.evaluation.technicianId,
      signedAt,
      supersedesVersionId: previousVersion?.id,
    };
    await this.reports.saveVersion(version);

    const signGate = canTransitionEvaluation(check.evaluation.state, EvaluationState.SIGNED);
    if (signGate.ok === false) return failure(signGate.error);
    check = {
      ...check,
      evaluation: {
        ...check.evaluation,
        state: EvaluationState.SIGNED,
        signedAt,
      },
    };
    await this.evaluations.saveEvaluation(check);

    const integrityVerified = await verifyReportIntegrity(canonicalPayload, integrityHash, this.hasher);
    return success({ evaluation: check, manifest, version, integrityVerified });
  }

  async verifyStoredVersion(evaluationId: EvaluationId): Promise<Result<SignedCheckReport, DomainError>> {
    const check = await this.evaluations.getEvaluation(evaluationId);
    if (!check) return failure(reportError('CHECK_EVALUATION_NOT_FOUND', 'AutoPulse Check evaluation was not found.', { evaluationId }));
    const version = await this.reports.getLatestVersion(evaluationId);
    if (!version) return failure(reportError('CHECK_REPORT_VERSION_NOT_FOUND', 'No signed report version exists for this evaluation.'));
    const stored = await this.reports.getManifest(version.manifestId);
    if (!stored) return failure(reportError('CHECK_REPORT_MANIFEST_NOT_FOUND', 'The signed report manifest could not be reconstructed.'));
    const integrityVerified = await verifyReportIntegrity(stored.canonicalPayload, version.integrityHash, this.hasher);
    return success({ evaluation: check, manifest: stored.manifest, version, integrityVerified });
  }
}
