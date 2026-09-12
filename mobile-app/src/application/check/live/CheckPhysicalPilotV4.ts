import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import type { Mode01DirectObservationResult } from '../parsers/Mode01DirectObservationParser';
import type { PlannedDiagnosticExecutionReceipt } from '../replay/DiagnosticExecutionPort';
import type { PlannedDiagnosticRequest } from '../planner/DiagnosticScanPlanner';
import { buildDiagnosticScanPlan } from '../planner/DiagnosticScanPlanner';
import { runDiagnosticScan, type DiagnosticScanEngineResult } from '../replay/DiagnosticScanEngine';
import {
  runCheckPhysicalPilot,
  type CheckPhysicalPilotResult,
  type CheckPhysicalPilotStage,
  type CheckPhysicalRawEvidence,
} from './CheckPhysicalPilot';
import { RealCheckPlannedExecutor, type CheckPilotCancellationToken } from './RealCheckPlannedExecutor';
import { RealObdController } from '../../../infrastructure/ble/real/RealObdController';
import { CHECK_CORE_DESCRIPTOR_REGISTRY_V3 } from '../intelligence/DiagnosticDescriptorRegistryV3';
import {
  buildDiagnosticEvidencePlanV2,
  type DiagnosticEvidencePlanV2,
} from '../intelligence/DiagnosticEvidencePlannerV2';
import {
  decodePromotedMode01Observation,
  type DecodedPidObservation,
} from '../intelligence/Mode01ValueDecoder';
import {
  decodePid0101Readiness,
  type DiagnosticReadinessObservation,
} from '../intelligence/ReadinessDecoder';
import {
  buildDiagnosticConcerns,
  type DiagnosticConcernV2,
} from '../intelligence/DiagnosticConcernEngine';

export const CHECK_PHYSICAL_PILOT_V4_VERSION = 'check-physical-pilot/v4' as const;

export type CheckPhysicalPilotStageV4 =
  | CheckPhysicalPilotStage
  | 'PLANNING_TARGETED_EVIDENCE'
  | 'RUNNING_TARGETED_EVIDENCE'
  | 'CORRELATING_DIAGNOSTIC_EVIDENCE';

export interface CheckPhysicalPilotV4Result extends Omit<
  CheckPhysicalPilotResult,
  'pilotVersion' | 'rawEvidence' | 'userLimitations' | 'technicalLimitations' | 'limitations'
> {
  readonly pilotVersion: typeof CHECK_PHYSICAL_PILOT_V4_VERSION;
  readonly targetedEvidencePlan: DiagnosticEvidencePlanV2;
  readonly targetedEvidenceScan: DiagnosticScanEngineResult | null;
  readonly decodedPidEvidence: readonly DecodedPidObservation[];
  readonly readiness: DiagnosticReadinessObservation | null;
  readonly concerns: readonly DiagnosticConcernV2[];
  readonly rawEvidence: readonly CheckPhysicalRawEvidence[];
  readonly userLimitations: readonly string[];
  readonly technicalLimitations: readonly string[];
  readonly limitations: readonly string[];
}

export interface RunCheckPhysicalPilotV4Input {
  readonly controller: RealObdController;
  readonly connectionHandleId: string;
  readonly cancellation: CheckPilotCancellationToken;
  readonly onStage?: (stage: CheckPhysicalPilotStageV4) => void;
}

const V4_PROVENANCE = 'CHECK physical pilot v4; read-only targeted evidence; large PID wallet is knowledge, not a blind scan list';
const MIN_INTER_COMMAND_DELAY_MS = 120;
const REQUEST_TIMEOUT_MS = 7000;

function collectReceiptEvidence(
  request: PlannedDiagnosticRequest,
  receipt: PlannedDiagnosticExecutionReceipt,
  sink: CheckPhysicalRawEvidence[],
): void {
  receipt.responses.forEach(response => sink.push(Object.freeze({
    phase: 'DIRECT_OBSERVATION' as const,
    semanticId: request.semanticId,
    service: request.service,
    pid: request.pid,
    sourceEndpointId: response.envelope.sourceEndpointId,
    responseKind: response.envelope.kind,
    rawText: response.envelope.rawText?.trim() || null,
    observedResponseBytes: response.observedResponseBytes,
  })));
}

function advertisedPidsFromBase(base: CheckPhysicalPilotResult): readonly string[] {
  const values = base.capabilityAssessment.observations
    .filter(item => item.outcome === 'VALID')
    .flatMap(item => item.advertisedPids);
  return Object.freeze([...new Set(values)]);
}

function dtcCodesFromBase(base: CheckPhysicalPilotResult): readonly string[] {
  return Object.freeze([...new Set(base.scan.dtcResults
    .filter(result => result.outcome === 'SUCCESS_WITH_CODES')
    .flatMap(result => result.codes.map(item => item.code)))].sort());
}

function buildTargetedPlan(protocol: DiagnosticProtocol, evidencePlan: DiagnosticEvidencePlanV2) {
  return buildDiagnosticScanPlan({
    planId: `check-v4-targeted:${Date.now()}`,
    createdAt: Date.now(),
    protocol,
    registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
    proposals: evidencePlan.requests.map(request => ({
      semanticId: request.semanticId,
      required: request.reason === 'READINESS_BASELINE',
      rationaleEvidenceIds: [
        `planner:${evidencePlan.version}`,
        `selection:${request.reason}`,
        ...request.relatedDtcs.map(code => `dtc:${code}`),
        ...(request.advertised ? [`advertised:01${request.pid}`] : ['bounded-fallback']),
      ],
    })),
    budget: {
      maxCommands: Math.max(1, evidencePlan.requests.length),
      maxResponseBytes: 4096,
      maxBytesPerResponse: 512,
      maxElapsedMs: 45000,
      minInterCommandDelayMs: MIN_INTER_COMMAND_DELAY_MS,
      provenance: V4_PROVENANCE,
    },
    retryPolicy: {
      maxRetries: 0,
      retryableOutcomes: [],
      responsePending: { maxExtensions: 0, extensionMs: 1000 },
      provenance: `${V4_PROVENANCE}; no automatic resend`,
    },
    deadlinePolicy: {
      overallDeadlineMs: 45000,
      stageDeadlineMs: {
        CAPABILITY_DISCOVERY: 45000,
        DTC_CORE: 45000,
        TARGETED_PID_ACQUISITION: 40000,
      },
      provenance: `${V4_PROVENANCE}; serial bounded enrichment`,
    },
  });
}

export async function runCheckPhysicalPilotV4(input: RunCheckPhysicalPilotV4Input): Promise<CheckPhysicalPilotV4Result> {
  const base = await runCheckPhysicalPilot({
    controller: input.controller,
    connectionHandleId: input.connectionHandleId,
    cancellation: input.cancellation,
    onStage: stage => input.onStage?.(stage),
  });

  input.onStage?.('PLANNING_TARGETED_EVIDENCE');
  const evidencePlan = buildDiagnosticEvidencePlanV2({
    dtcCodes: dtcCodesFromBase(base),
    advertisedPids: advertisedPidsFromBase(base),
    capabilityInconclusive: base.capabilityAssessment.state !== 'ADVERTISED',
    maxCommands: 12,
  });

  const targetedRaw: CheckPhysicalRawEvidence[] = [];
  let targetedEvidenceScan: DiagnosticScanEngineResult | null = null;
  const targetedLimitations: string[] = [];

  if (evidencePlan.requests.length > 0 && !input.cancellation.isCancelled) {
    const plan = buildTargetedPlan(base.protocol, evidencePlan);
    if (plan.status === 'BLOCKED') {
      targetedLimitations.push(...plan.blockedProposals.map(item => `v4-targeted:${item.semanticId}:${item.reason}`));
    } else {
      input.onStage?.('RUNNING_TARGETED_EVIDENCE');
      const executor = new RealCheckPlannedExecutor(
        input.controller,
        base.protocol,
        `${V4_PROVENANCE}; connection=${input.connectionHandleId}`,
        REQUEST_TIMEOUT_MS,
        MIN_INTER_COMMAND_DELAY_MS,
        input.cancellation,
        (request, receipt) => collectReceiptEvidence(request, receipt, targetedRaw),
      );
      targetedEvidenceScan = await runDiagnosticScan({ plan, executor });
      targetedLimitations.push(...targetedEvidenceScan.limitations);
      targetedLimitations.push(...plan.blockedProposals.map(item => `v4-targeted:${item.semanticId}:${item.reason}`));
    }
  }

  input.onStage?.('CORRELATING_DIAGNOSTIC_EVIDENCE');
  const targetedResults: readonly Mode01DirectObservationResult[] = targetedEvidenceScan?.mode01DirectResults ?? [];
  const allMode01Evidence: readonly Mode01DirectObservationResult[] = Object.freeze([
    ...(base.directObservationScan?.mode01DirectResults ?? []),
    ...targetedResults,
  ]);
  const decodedPidEvidence = Object.freeze(allMode01Evidence
    .map(decodePromotedMode01Observation)
    .filter((value): value is DecodedPidObservation => Boolean(value)));
  const readiness = targetedResults
    .map(decodePid0101Readiness)
    .find((value): value is DiagnosticReadinessObservation => Boolean(value)) ?? null;
  const concerns = buildDiagnosticConcerns(base.scan.dtcResults, decodedPidEvidence);

  const baseUserLimitations = base.userLimitations.filter(item => !item.startsWith('Readiness, Mode 06 and Freeze Frame'));
  const userLimitations = Object.freeze([
    ...baseUserLimitations,
    'Readiness is decoded from PID 0101 when a validated response is observed. NOT_READY does not mean a monitor failed.',
    'Mode 06 and Freeze Frame remain gated until their physical/replay decoder contracts are promoted; v4 does not guess them.',
    'The PID wallet contains broad reference knowledge, but Check executes only the small concern-driven read-only subset selected for this vehicle.',
  ]);
  const technicalLimitations = Object.freeze([...base.technicalLimitations, ...targetedLimitations]);
  const limitations = Object.freeze([...technicalLimitations, ...userLimitations]);

  return Object.freeze({
    ...base,
    pilotVersion: CHECK_PHYSICAL_PILOT_V4_VERSION,
    targetedEvidencePlan: evidencePlan,
    targetedEvidenceScan,
    decodedPidEvidence,
    readiness,
    concerns,
    rawEvidence: Object.freeze([...base.rawEvidence, ...targetedRaw]),
    userLimitations,
    technicalLimitations,
    limitations,
  });
}
