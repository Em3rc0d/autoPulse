import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../DiagnosticDescriptorRegistry';
import {
  buildDiagnosticScanPlan,
  normalizeEndpointAdvertisedCapabilities,
} from '../DiagnosticScanPlanner';

const budget = {
  maxCommands: 4,
  maxResponseBytes: 1024,
  maxBytesPerResponse: 256,
  maxElapsedMs: 5000,
  minInterCommandDelayMs: 0,
  provenance: 'mk9:endpoint-capability-validation',
} as const;

const retryPolicy = {
  maxRetries: 0,
  retryableOutcomes: [] as const,
  responsePending: { maxExtensions: 1, extensionMs: 100 },
  provenance: 'mk9:endpoint-capability-validation',
} as const;

const deadlinePolicy = {
  overallDeadlineMs: 5000,
  stageDeadlineMs: { CAPABILITY_DISCOVERY: 2500, DTC_CORE: 2500 },
  provenance: 'mk9:endpoint-capability-validation',
} as const;

const buildSupport20 = (endpointAdvertisedCapabilities: Parameters<typeof buildDiagnosticScanPlan>[0]['endpointAdvertisedCapabilities']) =>
  buildDiagnosticScanPlan({
    planId: 'mk9-capability-plan',
    createdAt: 1000,
    protocol: 'ISO_14230_KWP',
    registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
    proposals: [{
      semanticId: 'check.obd.mode01.support.20',
      required: true,
      targetEndpointId: 'ecu-a',
    }],
    endpointAdvertisedCapabilities,
    budget,
    retryPolicy,
    deadlinePolicy,
  });

describe('CHECK-MK9 endpoint advertised capability evidence', () => {
  it('normalizes endpoint, Mode 01 command and evidence identities before planning', () => {
    const normalized = normalizeEndpointAdvertisedCapabilities([{
      endpointId: ' ecu-a ',
      advertisedPids: [' 0101 ', ' 0120 '],
      evidenceIds: [' evidence-0100-ecu-a '],
    }]);

    expect(normalized).toEqual([{
      endpointId: 'ecu-a',
      advertisedPids: ['0101', '0120'],
      evidenceIds: ['evidence-0100-ecu-a'],
    }]);

    const plan = buildSupport20([{
      endpointId: ' ecu-a ',
      advertisedPids: [' 0120 '],
      evidenceIds: [' evidence-0100-ecu-a '],
    }]);
    expect(plan.status).toBe('READY');
    expect(plan.requests[0].rationaleEvidenceIds).toContain('evidence-0100-ecu-a');
  });

  it('rejects duplicate endpoint capability rows instead of letting array order select evidence', () => {
    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0120'], evidenceIds: ['e-a-1'] },
      { endpointId: 'ecu-a', advertisedPids: ['0140'], evidenceIds: ['e-a-2'] },
    ])).toThrow('Duplicate endpoint advertised capability evidence for ecu-a');
  });

  it('rejects malformed or non-Mode-01 advertised commands', () => {
    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['120'], evidenceIds: ['e-a'] },
    ])).toThrow('must be a four-hex command');

    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0220'], evidenceIds: ['e-a'] },
    ])).toThrow('is not Mode 01 capability evidence');
  });

  it('rejects duplicate advertised PID identities after normalization', () => {
    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0120', ' 0120 '], evidenceIds: ['e-a'] },
    ])).toThrow('advertisedPids contains duplicates');
  });

  it('requires non-empty unique provenance evidence for capability claims', () => {
    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0120'], evidenceIds: [] },
    ])).toThrow('require evidenceIds');

    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0120'], evidenceIds: ['e-a', ' e-a '] },
    ])).toThrow('evidenceIds contains duplicates');

    expect(() => buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0120'], evidenceIds: ['   '] },
    ])).toThrow('contains an empty identifier');
  });

  it('keeps continuation authorization endpoint-local even with multiple validated rows', () => {
    const plan = buildSupport20([
      { endpointId: 'ecu-a', advertisedPids: ['0101'], evidenceIds: ['e-a'] },
      { endpointId: 'ecu-b', advertisedPids: ['0120'], evidenceIds: ['e-b'] },
    ]);

    expect(plan.status).toBe('BLOCKED');
    expect(plan.requests).toEqual([]);
    expect(plan.blockedProposals[0].reason).toBe('DESCRIPTOR_PRECONDITION_NOT_MET');
  });
});
