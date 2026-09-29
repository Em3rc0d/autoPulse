import type { DiagnosticRequestDescriptor } from '../DiagnosticRequestDescriptor';
import { authorizeRegisteredDescriptor } from '../DiagnosticCommandSafetyPolicy';
import { createDiagnosticDescriptorRegistry } from '../DiagnosticDescriptorRegistry';
import {
  CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
  CHECK_V4_TARGETED_MODE01_PIDS,
} from '../DiagnosticDescriptorRegistryV3';
import { buildDiagnosticScanPlan } from '../DiagnosticScanPlanner';

const budget = {
  maxCommands: 12,
  maxResponseBytes: 4096,
  maxBytesPerResponse: 512,
  maxElapsedMs: 45000,
  minInterCommandDelayMs: 120,
  provenance: 'CHECK-v4.1 safety integration test',
} as const;

const retryPolicy = {
  maxRetries: 0,
  retryableOutcomes: [] as const,
  responsePending: { maxExtensions: 0, extensionMs: 1000 },
  provenance: 'CHECK-v4.1 safety integration test',
} as const;

const deadlinePolicy = {
  overallDeadlineMs: 45000,
  stageDeadlineMs: {
    CAPABILITY_DISCOVERY: 45000,
    DTC_CORE: 45000,
    TARGETED_PID_ACQUISITION: 40000,
  },
  provenance: 'CHECK-v4.1 safety integration test',
} as const;

describe('CHECK v4.1 canonical Registry V3 safety authority', () => {
  it.each(CHECK_V4_TARGETED_MODE01_PIDS)(
    'allows exact canonical PID 01%s on KWP and only KWP',
    pid => {
      const semanticId = `check.obd.mode01.observe.${pid}`;
      expect(authorizeRegisteredDescriptor(
        CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
        semanticId,
        'ISO_14230_KWP',
      )).toEqual(expect.objectContaining({ disposition: 'ALLOW' }));

      expect(authorizeRegisteredDescriptor(
        CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
        semanticId,
        'ISO_15765_CAN',
      )).toEqual(expect.objectContaining({
        disposition: 'BLOCK',
        reason: 'PROTOCOL_NOT_PROMOTED',
      }));
    },
  );

  it('still rejects a look-alike V3 registry with a noncanonical version', () => {
    const canonical = CHECK_CORE_DESCRIPTOR_REGISTRY_V3.bySemanticId['check.obd.mode01.observe.01'];
    const lookAlike = createDiagnosticDescriptorRegistry('check-core-descriptors/v3-lookalike', [canonical]);

    expect(authorizeRegisteredDescriptor(
      lookAlike,
      canonical.semanticId,
      'ISO_14230_KWP',
    )).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'REGISTRY_NOT_ALLOWLISTED',
    }));
  });

  it('rejects a tampered descriptor even when the attacker reuses the canonical V3 version', () => {
    const canonical = CHECK_CORE_DESCRIPTOR_REGISTRY_V3.bySemanticId['check.obd.mode01.observe.01'];
    const tamperedDescriptor: DiagnosticRequestDescriptor = {
      ...canonical,
      provenance: `${canonical.provenance}; tampered`,
    };
    const tampered = createDiagnosticDescriptorRegistry(
      CHECK_CORE_DESCRIPTOR_REGISTRY_V3.version,
      [tamperedDescriptor],
    );

    expect(authorizeRegisteredDescriptor(
      tampered,
      canonical.semanticId,
      'ISO_14230_KWP',
    )).toEqual(expect.objectContaining({
      disposition: 'BLOCK',
      reason: 'DESCRIPTOR_DEFINITION_MISMATCH',
    }));
  });

  it('turns the exact readiness semantic selected by the Logan fallback into an executable planned request', () => {
    const plan = buildDiagnosticScanPlan({
      planId: 'check-v4.1-logan-readiness',
      createdAt: 1,
      protocol: 'ISO_14230_KWP',
      registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
      proposals: [{
        semanticId: 'check.obd.mode01.observe.01',
        required: true,
        rationaleEvidenceIds: ['planner:check-evidence-planner/v2', 'bounded-fallback'],
      }],
      budget,
      retryPolicy,
      deadlinePolicy,
    });

    expect(plan.status).toBe('READY');
    expect(plan.blockedProposals).toEqual([]);
    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0]).toEqual(expect.objectContaining({
      service: '01',
      pid: '01',
      semanticId: 'check.obd.mode01.observe.01',
      executionMode: 'SERIAL_ONLY',
    }));
  });

  it('never turns the V3 allowlist itself into a blind scan', () => {
    const plan = buildDiagnosticScanPlan({
      planId: 'check-v4.1-bounded-selection',
      createdAt: 2,
      protocol: 'ISO_14230_KWP',
      registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V3,
      proposals: [
        { semanticId: 'check.obd.mode01.observe.01', required: true },
        { semanticId: 'check.obd.mode01.observe.05', required: false },
      ],
      budget: { ...budget, maxCommands: 2 },
      retryPolicy,
      deadlinePolicy,
    });

    expect(plan.requests.map(request => request.pid)).toEqual(['01', '05']);
    expect(plan.requests).toHaveLength(2);
    expect(plan.requests.length).toBeLessThan(CHECK_CORE_DESCRIPTOR_REGISTRY_V3.descriptors.length);
  });
});
