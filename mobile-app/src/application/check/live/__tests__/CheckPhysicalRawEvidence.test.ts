import type { PlannedDiagnosticExecutionReceipt } from '../../replay/DiagnosticExecutionPort';
import type { PlannedDiagnosticRequest } from '../../planner/DiagnosticScanPlanner';
import { CheckPilotCancellationToken, RealCheckPlannedExecutor } from '../RealCheckPlannedExecutor';

const planned: PlannedDiagnosticRequest = {
  planRequestId: 'plan:request:0',
  planId: 'plan',
  ordinal: 0,
  descriptorId: 'check-core-mode03-stored-dtc',
  semanticId: 'check.obd.mode03.stored-dtc',
  required: true,
  registryVersion: 'check-core-descriptors/v1',
  safetyPolicyVersion: 'check-command-safety/v2',
  parserContractId: 'check.dtc-service/v1',
  descriptorProvenance: 'fixture',
  stage: 'DTC_CORE',
  service: '03',
  expectedResponseService: '43',
  supportedProtocols: ['ISO_14230_KWP'],
  targetEndpointId: null,
  evidenceTraceId: 'trace',
  rationaleEvidenceIds: [],
  executionMode: 'SERIAL_ONLY',
};

describe('RealCheckPlannedExecutor receipt observer', () => {
  it('observes the normalized immutable receipt without adding a free-form execution path', async () => {
    const controller = {
      executeCommand: jest.fn().mockResolvedValue({
        request: { id: 'r', command: '03', family: 'OBD_MODE_03', expectedService: '43', timeoutMs: 1000 },
        rawResponse: { fragments: [], accumulatedText: '430000', completionReason: 'PROMPT_RECEIVED', startedAt: 1, finishedAt: 4, latencyMs: 3 },
        normalizedResponse: { rawText: '430000', normalizedText: '430000', echoLines: [], statusLines: [], candidateHexLines: ['430000'], unknownLines: [], promptDetected: true },
        classifiedLines: [], obdFrames: [], negativeResponses: [], decodedValues: [], status: 'SUCCESS_RAW', errors: [], latencyMs: 3,
      }),
    };
    const observed: PlannedDiagnosticExecutionReceipt[] = [];
    const executor = new RealCheckPlannedExecutor(
      controller as never,
      'ISO_14230_KWP',
      'fixture',
      1000,
      0,
      new CheckPilotCancellationToken(),
      (_request, receipt) => observed.push(receipt),
    );

    const receipt = await executor.executeCommand(planned, 0, 100);

    expect(controller.executeCommand).toHaveBeenCalledTimes(1);
    expect(observed).toEqual([receipt]);
    expect(receipt.responses[0].envelope.rawText).toBe('430000');
    expect(Object.isFrozen(receipt)).toBe(true);
  });
});
