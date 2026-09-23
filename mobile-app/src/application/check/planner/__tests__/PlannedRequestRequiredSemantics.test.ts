import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../DiagnosticScanPlanner';

const inputBase = {
  planId: 'required-propagation',
  createdAt: 1,
  protocol: 'ISO_14230_KWP' as const,
  registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  budget: {
    maxCommands: 4,
    maxResponseBytes: 4096,
    maxBytesPerResponse: 1024,
    maxElapsedMs: 5000,
    minInterCommandDelayMs: 0,
    provenance: 'test',
  },
  retryPolicy: {
    maxRetries: 0,
    retryableOutcomes: [] as const,
    responsePending: { maxExtensions: 1, extensionMs: 100 },
    provenance: 'test',
  },
  deadlinePolicy: {
    overallDeadlineMs: 5000,
    stageDeadlineMs: { CAPABILITY_DISCOVERY: 1000, DTC_CORE: 4000 },
    provenance: 'test',
  },
};

describe('CHECK-MK5 planned request required semantics', () => {
  it('preserves required/optional truth into the immutable execution plan', () => {
    const plan = buildDiagnosticScanPlan({
      ...inputBase,
      proposals: [
        { semanticId: 'check.obd.mode03.stored-dtc', required: true },
        { semanticId: 'check.obd.mode0a.permanent-dtc', required: false },
      ],
    });

    expect(plan.status).toBe('READY');
    expect(plan.requests.map(request => [request.semanticId, request.required])).toEqual([
      ['check.obd.mode03.stored-dtc', true],
      ['check.obd.mode0a.permanent-dtc', false],
    ]);
  });

  it('keeps required dominant when duplicate proposals disagree', () => {
    const plan = buildDiagnosticScanPlan({
      ...inputBase,
      proposals: [
        { semanticId: 'check.obd.mode03.stored-dtc', required: false },
        { semanticId: 'check.obd.mode03.stored-dtc', required: true },
      ],
    });

    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0].required).toBe(true);
  });
});
