import { CHECK_CORE_DESCRIPTOR_REGISTRY_V1 } from '../../planner/DiagnosticDescriptorRegistry';
import { buildDiagnosticScanPlan } from '../../planner/DiagnosticScanPlanner';
import { DiagnosticReplayExecutor, DiagnosticReplayFixtureError } from '../DiagnosticReplayExecutor';
import { assertValidDiagnosticReplayFixture } from '../DiagnosticReplayFixture';
import { CHECK_REPLAY_STORED_SINGLE_KWP } from '../fixtures/DiagnosticReplayCorpusV1';

const request = buildDiagnosticScanPlan({
  planId: 'executor-test',
  createdAt: 1000,
  protocol: 'ISO_14230_KWP',
  registry: CHECK_CORE_DESCRIPTOR_REGISTRY_V1,
  proposals: [{ semanticId: 'check.obd.mode03.stored-dtc', required: true, targetEndpointId: 'ecu-engine' }],
  budget: { maxCommands: 2, maxResponseBytes: 100, maxBytesPerResponse: 50, maxElapsedMs: 1000, minInterCommandDelayMs: 0, provenance: 'test' },
  retryPolicy: { maxRetries: 0, retryableOutcomes: [], responsePending: { maxExtensions: 1, extensionMs: 100 }, provenance: 'test' },
  deadlinePolicy: { overallDeadlineMs: 1000, stageDeadlineMs: { CAPABILITY_DISCOVERY: 500, DTC_CORE: 1000 }, provenance: 'test' },
}).requests[0];

describe('CHECK-MK6/7 DiagnosticReplayExecutor', () => {
  it('consumes only the scripted event kind and preserves deterministic timing', async () => {
    const executor = new DiagnosticReplayExecutor(CHECK_REPLAY_STORED_SINGLE_KWP);
    const receipt = await executor.executeCommand(request, 0, 1000);

    expect(receipt.startedAt).toBe(1000);
    expect(receipt.finishedAt).toBe(1010);
    expect(receipt.responses).toHaveLength(1);
    expect(receipt.responses[0].envelope.observedAt).toBe(1010);
    expect(receipt.responses[0].observedResponseBytes).toBe(3);
  });

  it('fails closed when a script is exhausted instead of recycling evidence', async () => {
    const executor = new DiagnosticReplayExecutor(CHECK_REPLAY_STORED_SINGLE_KWP);
    await executor.executeCommand(request, 0, 1000);
    await expect(executor.executeCommand(request, 1, 1010)).rejects.toThrow(DiagnosticReplayFixtureError);
  });

  it('rejects protocol-mismatched fixture envelopes at construction time', () => {
    expect(() => assertValidDiagnosticReplayFixture({
      fixtureId: 'bad-protocol', protocol: 'ISO_14230_KWP', provenance: 'test', startedAt: 1000,
      scripts: [{
        semanticId: 'check.obd.mode03.stored-dtc', targetEndpointId: 'ecu-engine',
        events: [{
          kind: 'COMMAND_RESPONSE', durationMs: 1, observedResponseBytes: 1,
          envelope: { kind: 'NO_DATA', requestService: '03', protocol: 'ISO_15765_CAN', sourceEndpointId: 'ecu-engine', provenance: 'test', observedAt: 1001 },
        }],
      }],
    })).toThrow('protocol mismatch');
  });

  it('preserves several ECU responses from one semantic command without inventing extra commands', async () => {
    const fixture = {
      fixtureId: 'multi-response', protocol: 'ISO_14230_KWP' as const, provenance: 'test', startedAt: 1000,
      scripts: [{
        semanticId: 'check.obd.mode03.stored-dtc', targetEndpointId: 'ecu-engine',
        events: [{
          kind: 'COMMAND_RESPONSE' as const, durationMs: 10,
          responses: [
            { observedResponseBytes: 3, envelope: { kind: 'POSITIVE_RESPONSE' as const, requestService: '03', responseService: '43', payload: [0x01, 0x33], protocol: 'ISO_14230_KWP' as const, sourceEndpointId: 'ecu-a', provenance: 'test', observedAt: 1010 } },
            { observedResponseBytes: 3, envelope: { kind: 'POSITIVE_RESPONSE' as const, requestService: '03', responseService: '43', payload: [0x04, 0x20], protocol: 'ISO_14230_KWP' as const, sourceEndpointId: 'ecu-b', provenance: 'test', observedAt: 1010 } },
          ],
        }],
      }],
    };

    const receipt = await new DiagnosticReplayExecutor(fixture).executeCommand(request, 0, 1000);
    expect(receipt.responses.map(item => item.envelope.sourceEndpointId)).toEqual(['ecu-a', 'ecu-b']);
  });
});
