import type { DiagnosticProtocol } from '../../../domain/diagnostics/DiagnosticConnector';
import { RealObdController } from '../../../infrastructure/ble/real/RealObdController';
import type { CommandRequest, CommandResult } from '../../../infrastructure/ble/real/pipeline/types';
import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1, resolveDescriptorBySemanticId } from '../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../planner/DiagnosticScanPlanner';
import type { DiagnosticScanEngineResult } from '../replay/DiagnosticScanEngine';
import { runDiagnosticScan } from '../replay/DiagnosticScanEngine';
import { CheckPilotCancellationToken, RealCheckPlannedExecutor } from './RealCheckPlannedExecutor';

export const CHECK_PHYSICAL_PILOT_VERSION = 'check-physical-pilot/v1' as const;

export type CheckPhysicalPilotStage =
  | 'PREPARING_ADAPTER'
  | 'NEGOTIATING_PROTOCOL'
  | 'RUNNING_DTC_SCAN'
  | 'SEALING_PILOT_RESULT';

export interface CheckPhysicalPilotResult {
  readonly pilotVersion: typeof CHECK_PHYSICAL_PILOT_VERSION;
  readonly protocol: DiagnosticProtocol;
  readonly protocolEvidence: string;
  readonly scan: DiagnosticScanEngineResult;
  readonly cancelled: boolean;
  readonly limitations: readonly string[];
}

export interface RunCheckPhysicalPilotInput {
  readonly controller: RealObdController;
  readonly connectionHandleId: string;
  readonly cancellation: CheckPilotCancellationToken;
  readonly onStage?: (stage: CheckPhysicalPilotStage) => void;
}

const PILOT_PROVENANCE = 'CHECK physical pilot v1; descriptor-gated; timing/vehicle compatibility not yet physically certified';
const REQUEST_TIMEOUT_MS = 7000;
const MIN_INTER_COMMAND_DELAY_MS = 120;

function adapterRequest(command: string, timeoutMs = 3500): CommandRequest {
  return {
    id: `check-adapter:${command}:${Date.now()}`,
    command,
    family: 'ELM_AT',
    timeoutMs,
  };
}

function isTransportSuccess(result: CommandResult): boolean {
  return result.status === 'SUCCESS_RAW' || result.status === 'SUCCESS_DECODED';
}

async function prepareAdapter(controller: RealObdController, cancellation: CheckPilotCancellationToken): Promise<void> {
  // Adapter-only controls. No ECU mutation/control services are present here.
  for (const command of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'] as const) {
    if (cancellation.isCancelled) throw new Error('CHECK_CANCELLED');
    const result = await controller.executeCommand(adapterRequest(command));
    if (!isTransportSuccess(result)) {
      throw new Error(`CHECK_ADAPTER_SETUP_FAILED:${command}:${result.status}`);
    }
  }
}

async function bootstrapStandardObd(
  controller: RealObdController,
  cancellation: CheckPilotCancellationToken,
): Promise<void> {
  if (cancellation.isCancelled) throw new Error('CHECK_CANCELLED');
  const descriptor = resolveDescriptorBySemanticId(
    CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
    'check.obd.mode01.support.00',
  );
  if (!descriptor || descriptor.safetyClassification !== 'READ_ONLY_PROVEN' || descriptor.requestKind !== 'OBD_STANDARD') {
    throw new Error('CHECK_BOOTSTRAP_DESCRIPTOR_NOT_PROVEN');
  }
  if (descriptor.service !== '01' || descriptor.pid !== '00' || descriptor.expectedResponseService !== '41') {
    throw new Error('CHECK_BOOTSTRAP_DESCRIPTOR_IDENTITY_MISMATCH');
  }

  const result = await controller.executeCommand({
    id: `check-bootstrap:${Date.now()}`,
    command: `${descriptor.service}${descriptor.pid}`,
    family: 'OBD_MODE_01',
    expectedService: descriptor.expectedResponseService,
    expectedPid: descriptor.pid,
    timeoutMs: 12000,
  });
  if (!isTransportSuccess(result)) {
    throw new Error(`CHECK_STANDARD_OBD_UNREACHABLE:${result.status}`);
  }
}

function normalizedAdapterText(result: CommandResult): string {
  return (result.normalizedResponse?.normalizedText || result.rawResponse?.accumulatedText || '')
    .replace(/>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function diagnosticProtocolFromElmEvidence(raw: string): DiagnosticProtocol {
  const upper = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  const compact = upper.replace(/\s+/g, '');
  const codeMatch = compact.match(/A?([1-9])$/);
  const code = codeMatch?.[1];
  if (code === '1') return 'SAE_J1850_PWM';
  if (code === '2') return 'SAE_J1850_VPW';
  if (code === '3') return 'ISO_9141_2';
  if (code === '4' || code === '5') return 'ISO_14230_KWP';
  if (code === '6' || code === '7' || code === '8' || code === '9') return 'ISO_15765_CAN';

  if (upper.includes('14230') || upper.includes('KWP')) return 'ISO_14230_KWP';
  if (upper.includes('9141')) return 'ISO_9141_2';
  if (upper.includes('J1850 PWM')) return 'SAE_J1850_PWM';
  if (upper.includes('J1850 VPW')) return 'SAE_J1850_VPW';
  if (upper.includes('15765') || upper.includes('CAN')) return 'ISO_15765_CAN';
  return 'UNKNOWN';
}

async function discoverProtocol(
  controller: RealObdController,
  cancellation: CheckPilotCancellationToken,
): Promise<{ protocol: DiagnosticProtocol; evidence: string }> {
  if (cancellation.isCancelled) throw new Error('CHECK_CANCELLED');
  const numberResult = await controller.executeCommand(adapterRequest('ATDPN'));
  const numberEvidence = normalizedAdapterText(numberResult);
  let protocol = isTransportSuccess(numberResult) ? diagnosticProtocolFromElmEvidence(numberEvidence) : 'UNKNOWN';
  let evidence = numberEvidence;

  if (protocol === 'UNKNOWN') {
    const nameResult = await controller.executeCommand(adapterRequest('ATDP'));
    const nameEvidence = normalizedAdapterText(nameResult);
    protocol = isTransportSuccess(nameResult) ? diagnosticProtocolFromElmEvidence(nameEvidence) : 'UNKNOWN';
    evidence = nameEvidence || numberEvidence;
  }

  if (protocol === 'UNKNOWN') throw new Error(`CHECK_PROTOCOL_UNRESOLVED:${evidence || 'NO_EVIDENCE'}`);
  return { protocol, evidence };
}

export async function runCheckPhysicalPilot(input: RunCheckPhysicalPilotInput): Promise<CheckPhysicalPilotResult> {
  const { controller, cancellation } = input;
  input.onStage?.('PREPARING_ADAPTER');
  await prepareAdapter(controller, cancellation);

  input.onStage?.('NEGOTIATING_PROTOCOL');
  await bootstrapStandardObd(controller, cancellation);
  const protocolEvidence = await discoverProtocol(controller, cancellation);

  if (cancellation.isCancelled) throw new Error('CHECK_CANCELLED');
  const plan = buildDiagnosticScanPlan({
    planId: `check-pilot:${Date.now()}`,
    createdAt: Date.now(),
    protocol: protocolEvidence.protocol,
    registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
    proposals: [
      { semanticId: 'check.obd.mode01.support.00', required: true },
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode07.pending-dtc', required: false },
      { semanticId: 'check.obd.mode0a.permanent-dtc', required: false },
    ],
    budget: {
      maxCommands: 4,
      maxResponseBytes: 2048,
      maxBytesPerResponse: 512,
      maxElapsedMs: 30000,
      minInterCommandDelayMs: MIN_INTER_COMMAND_DELAY_MS,
      provenance: PILOT_PROVENANCE,
    },
    retryPolicy: {
      maxRetries: 0,
      retryableOutcomes: [],
      responsePending: { maxExtensions: 0, extensionMs: 1000 },
      provenance: `${PILOT_PROVENANCE}; no automatic resend and no unproven passive pending continuation`,
    },
    deadlinePolicy: {
      overallDeadlineMs: 30000,
      stageDeadlineMs: {
        CAPABILITY_DISCOVERY: 12000,
        DTC_CORE: 24000,
      },
      provenance: PILOT_PROVENANCE,
    },
  });

  if (plan.status === 'BLOCKED') {
    throw new Error(`CHECK_PLAN_BLOCKED:${plan.blockedProposals.map(item => `${item.semanticId}:${item.reason}`).join(',')}`);
  }

  input.onStage?.('RUNNING_DTC_SCAN');
  const executor = new RealCheckPlannedExecutor(
    controller,
    protocolEvidence.protocol,
    `${PILOT_PROVENANCE}; connection=${input.connectionHandleId}`,
    REQUEST_TIMEOUT_MS,
    MIN_INTER_COMMAND_DELAY_MS,
    cancellation,
  );
  const scan = await runDiagnosticScan({ plan, executor });

  input.onStage?.('SEALING_PILOT_RESULT');
  const limitations = [
    ...scan.limitations,
    ...plan.blockedProposals.map(item => `${item.semanticId}:${item.reason}`),
    'Physical pilot evidence is not a mechanical PASS/FAIL verdict.',
    'ABS, SRS, transmission and manufacturer-enhanced modules are not claimed by this standard OBD pilot.',
    'Readiness/Mode 06/Freeze Frame remain outside this first physically activated descriptor set.',
  ];

  return Object.freeze({
    pilotVersion: CHECK_PHYSICAL_PILOT_VERSION,
    protocol: protocolEvidence.protocol,
    protocolEvidence: protocolEvidence.evidence,
    scan,
    cancelled: cancellation.isCancelled,
    limitations: Object.freeze(limitations),
  });
}
