import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan, evidenceTraceForPlannedRequest, evaluatePlannedRequestGate } from '../DiagnosticScanPlanner';

const budget = {
  maxCommands: 6, maxResponseBytes: 4096, maxBytesPerResponse: 1024, maxElapsedMs: 5000, minInterCommandDelayMs: 50,
  provenance: 'fixture-budget',
} as const;
const retryPolicy = {
  maxRetries: 1, retryableOutcomes: ['TIMEOUT'] as const, responsePending: { maxExtensions: 2, extensionMs: 200 }, provenance: 'fixture-retry',
} as const;
const deadlinePolicy = {
  overallDeadlineMs: 5000, stageDeadlineMs: { CAPABILITY_DISCOVERY: 1500, DTC_CORE: 3000 }, provenance: 'fixture-deadline',
} as const;
const build = (overrides: Partial<Parameters<typeof buildDiagnosticScanPlan>[0]> = {}) => buildDiagnosticScanPlan({
  planId: 'plan-1', createdAt: 100, protocol: 'ISO_14230_KWP', registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  proposals: [
    { semanticId: 'check.obd.mode03.stored-dtc', required: true },
    { semanticId: 'check.obd.mode07.pending-dtc', required: true },
    { semanticId: 'check.obd.mode0a.permanent-dtc', required: false },
  ],
  budget, retryPolicy, deadlinePolicy, ...overrides,
});

describe('CHECK-MK5 DiagnosticScanPlanner', () => {
  it('builds a serial descriptor-only plan with deterministic evidence traceability', () => {
    const plan = build();
    expect(plan.status).toBe('READY');
    expect(plan.serialExecution).toBe(true);
    expect(plan.requests.map(item => item.semanticId)).toEqual(['check.obd.mode03.stored-dtc', 'check.obd.mode07.pending-dtc', 'check.obd.mode0a.permanent-dtc']);
    expect(plan.requests.every(item => item.executionMode === 'SERIAL_ONLY')).toBe(true);
    const first = plan.requests[0];
    expect(first.descriptorId).toBe('check-core-mode03-stored-dtc');
    expect(first.parserContractId).toBe('check.dtc-service/v1');
    expect(first.supportedProtocols).toContain('ISO_14230_KWP');
    expect(first.evidenceTraceId).toContain('plan-1:evidence:0:check-core-mode03-stored-dtc');
    expect(evidenceTraceForPlannedRequest(first)).toEqual(expect.objectContaining({ planId: 'plan-1', descriptorId: first.descriptorId, semanticId: first.semanticId, parserContractId: first.parserContractId }));
    expect('payload' in first).toBe(false);
    expect('command' in first).toBe(false);
  });

  it('orders capability discovery before DTC Core regardless of proposal input order', () => {
    const plan = build({ proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode01.support.00', required: true },
    ] });
    expect(plan.requests.map(item => item.stage)).toEqual(['CAPABILITY_DISCOVERY', 'DTC_CORE']);
  });

  it('never blind-plans a later support bitmap without endpoint advertisement evidence', () => {
    const blocked = build({ proposals: [{ semanticId: 'check.obd.mode01.support.20', required: true, targetEndpointId: 'ecu-a' }] });
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.requests).toEqual([]);
    expect(blocked.blockedProposals[0]).toEqual(expect.objectContaining({ semanticId: 'check.obd.mode01.support.20', reason: 'DESCRIPTOR_PRECONDITION_NOT_MET' }));
    const allowed = build({
      proposals: [{ semanticId: 'check.obd.mode01.support.20', required: true, targetEndpointId: 'ecu-a' }],
      endpointAdvertisedCapabilities: [{ endpointId: 'ecu-a', advertisedPids: ['0101', '0120'], evidenceIds: ['evidence-0100-ecu-a'] }],
    });
    expect(allowed.status).toBe('READY');
    expect(allowed.requests[0].semanticId).toBe('check.obd.mode01.support.20');
    expect(allowed.requests[0].rationaleEvidenceIds).toContain('evidence-0100-ecu-a');
  });

  it('does not borrow bitmap advertisement from a different endpoint', () => {
    const plan = build({
      proposals: [{ semanticId: 'check.obd.mode01.support.20', required: true, targetEndpointId: 'ecu-b' }],
      endpointAdvertisedCapabilities: [{ endpointId: 'ecu-a', advertisedPids: ['0120'], evidenceIds: ['evidence-ecu-a'] }],
    });
    expect(plan.status).toBe('BLOCKED');
    expect(plan.blockedProposals[0].reason).toBe('DESCRIPTOR_PRECONDITION_NOT_MET');
  });

  it('preserves required severity when duplicate proposals are consolidated', () => {
    const unsafe = build({ proposals: [
      { semanticId: 'check.obd.mode04.clear-dtc', required: false },
      { semanticId: 'check.obd.mode04.clear-dtc', required: true },
    ] });
    expect(unsafe.status).toBe('BLOCKED');
    expect(unsafe.blockedProposals).toEqual([expect.objectContaining({ semanticId: 'check.obd.mode04.clear-dtc', required: true, reason: 'UNREGISTERED_DESCRIPTOR' })]);
    const safe = build({ proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: false, rationaleEvidenceIds: ['e1'] },
      { semanticId: 'check.obd.mode03.stored-dtc', required: true, rationaleEvidenceIds: ['e2'] },
    ] });
    expect(safe.status).toBe('READY');
    expect(safe.requests).toHaveLength(1);
    expect(safe.requests[0].rationaleEvidenceIds).toEqual(['e1', 'e2']);
  });

  it('fails closed when required work is unregistered or protocol-unpromoted', () => {
    const unknown = build({ proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode04.clear-dtc', required: true },
    ] });
    expect(unknown.status).toBe('BLOCKED');
    expect(unknown.requests).toEqual([]);
    expect(unknown.blockedProposals[0]).toEqual(expect.objectContaining({ semanticId: 'check.obd.mode04.clear-dtc', reason: 'UNREGISTERED_DESCRIPTOR', required: true }));

    const protocol = build({ protocol: 'ISO_15765_CAN', proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode07.pending-dtc', required: true },
    ] });
    expect(protocol.status).toBe('BLOCKED');
    expect(protocol.requests).toEqual([]);
    expect(protocol.blockedProposals).toEqual([expect.objectContaining({ semanticId: 'check.obd.mode07.pending-dtc', reason: 'PROTOCOL_NOT_PROMOTED' })]);
  });

  it('degrades optional blocked work to LIMITED', () => {
    const plan = build({ proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode01.pid.FF', required: false },
    ] });
    expect(plan.status).toBe('LIMITED');
    expect(plan.requests.map(item => item.semanticId)).toEqual(['check.obd.mode03.stored-dtc']);
    expect(plan.blockedProposals[0].reason).toBe('UNREGISTERED_DESCRIPTOR');
  });

  it('blocks insufficient command capacity for required baseline and trims only optional overflow', () => {
    const blocked = build({ budget: { ...budget, maxCommands: 1 }, proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode07.pending-dtc', required: true },
    ] });
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.requests).toEqual([]);
    expect(blocked.blockedProposals.every(item => item.reason === 'PLAN_COMMAND_BUDGET_EXCEEDED')).toBe(true);

    const limited = build({ budget: { ...budget, maxCommands: 2 }, proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      { semanticId: 'check.obd.mode07.pending-dtc', required: true },
      { semanticId: 'check.obd.mode0a.permanent-dtc', required: false },
    ] });
    expect(limited.status).toBe('LIMITED');
    expect(limited.requests).toHaveLength(2);
    expect(limited.blockedProposals).toEqual([expect.objectContaining({ semanticId: 'check.obd.mode0a.permanent-dtc', reason: 'PLAN_COMMAND_BUDGET_EXCEEDED', required: false })]);
  });

  it('deduplicates only the same descriptor/endpoint pair and preserves multi-endpoint planning', () => {
    const plan = build({ proposals: [
      { semanticId: 'check.obd.mode03.stored-dtc', required: true, targetEndpointId: 'ecu-a' },
      { semanticId: 'check.obd.mode03.stored-dtc', required: true, targetEndpointId: 'ecu-a' },
      { semanticId: 'check.obd.mode03.stored-dtc', required: true, targetEndpointId: 'ecu-b' },
    ] });
    expect(plan.requests).toHaveLength(2);
    expect(plan.requests.map(item => item.targetEndpointId)).toEqual(['ecu-a', 'ecu-b']);
  });

  it('enforces serial request order before cancellation/deadline/pacing/budget gates', () => {
    const plan = build();
    const first = plan.requests[0];
    const second = plan.requests[1];
    const baseContext = {
      planRequestId: first.planRequestId, nextRequestOrdinal: 0, scanStartedAt: 0, stageStartedAt: 100, now: 200, cancelRequested: false,
      budgetUsage: { commandsIssued: 0, responseBytes: 0 },
    };
    expect(evaluatePlannedRequestGate(plan, baseContext).disposition).toBe('ALLOW');
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, planRequestId: second.planRequestId })).toEqual({ disposition: 'BLOCK', reason: 'OUT_OF_SEQUENCE' });
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, planRequestId: second.planRequestId, nextRequestOrdinal: 1 }).disposition).toBe('ALLOW');
    expect(() => evaluatePlannedRequestGate(plan, { ...baseContext, nextRequestOrdinal: -1 })).toThrow('non-negative integer');
  });

  it('prevents any new request after cancellation, deadline, pacing or budget exhaustion', () => {
    const plan = build();
    const request = plan.requests[0];
    const baseContext = {
      planRequestId: request.planRequestId, nextRequestOrdinal: 0, scanStartedAt: 0, stageStartedAt: 100, now: 200, cancelRequested: false,
      budgetUsage: { commandsIssued: 0, responseBytes: 0 },
    };
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, cancelRequested: true })).toEqual({ disposition: 'BLOCK', reason: 'CANCELLED' });
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, now: 3100 })).toEqual({ disposition: 'BLOCK', reason: 'STAGE_DEADLINE_EXCEEDED' });
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, lastCommandFinishedAt: 175 })).toEqual({ disposition: 'BLOCK', reason: 'INTER_COMMAND_DELAY_NOT_SATISFIED' });
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, lastCommandFinishedAt: 150 }).disposition).toBe('ALLOW');
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, budgetUsage: { commandsIssued: budget.maxCommands, responseBytes: 0 } })).toEqual({ disposition: 'BLOCK', reason: 'COMMAND_BUDGET_EXHAUSTED' });
    expect(evaluatePlannedRequestGate(plan, { ...baseContext, budgetUsage: { commandsIssued: 0, responseBytes: budget.maxResponseBytes } })).toEqual({ disposition: 'BLOCK', reason: 'TOTAL_BYTE_BUDGET_EXHAUSTED' });
  });

  it('rejects a request id that is not part of the immutable plan', () => {
    const plan = build();
    expect(evaluatePlannedRequestGate(plan, {
      planRequestId: 'forged-request', nextRequestOrdinal: 0, scanStartedAt: 0, stageStartedAt: 100, now: 200, cancelRequested: false,
      budgetUsage: { commandsIssued: 0, responseBytes: 0 },
    })).toEqual({ disposition: 'BLOCK', reason: 'REQUEST_NOT_IN_PLAN' });
  });
});
