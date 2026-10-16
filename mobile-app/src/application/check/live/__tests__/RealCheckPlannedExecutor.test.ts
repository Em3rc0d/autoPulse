import type { PlannedDiagnosticRequest } from '../../planner/DiagnosticScanPlanner';
import { CHECK_COMMAND_SAFETY_POLICY_VERSION } from '../../planner/DiagnosticCommandSafetyPolicy';
import { CheckPilotCancellationToken, RealCheckPlannedExecutor } from '../RealCheckPlannedExecutor';

function planned(service: string, expectedResponseService: string): PlannedDiagnosticRequest {
  return {
    planRequestId: `plan:request:${service}`,
    planId: 'plan',
    ordinal: 0,
    descriptorId: `fixture-${service}`,
    semanticId: `fixture.${service}`,
    required: true,
    registryVersion: 'check-core-descriptors/v1',
    safetyPolicyVersion: CHECK_COMMAND_SAFETY_POLICY_VERSION,
    parserContractId: 'fixture',
    descriptorProvenance: 'fixture',
    stage: 'DTC_CORE',
    service,
    expectedResponseService,
    supportedProtocols: ['ISO_14230_KWP'],
    targetEndpointId: null,
    evidenceTraceId: `trace-${service}`,
    rationaleEvidenceIds: [],
    executionMode: 'SERIAL_ONLY',
  };
}

describe('RealCheckPlannedExecutor physical boundary', () => {
  function noData(command = '03') {
    return {
      request: { id: 'fake', command, family: 'OBD_MODE_03', timeoutMs: 1000 },
      status: 'NO_DATA',
      latencyMs: 4,
      errors: [],
      rawResponse: null,
      normalizedResponse: null,
      classifiedLines: [],
      obdFrames: [],
      negativeResponses: [],
      decodedValues: [],
    } as const;
  }

  function held<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  it.each([
    ['01', '41', 'OBD_MODE_01'],
    ['03', '43', 'OBD_MODE_03'],
    ['07', '47', 'OBD_MODE_07'],
    ['0A', '4A', 'OBD_MODE_0A'],
  ])('dispatches allowlisted read-only %s via %s family', async (service, expectedResponse, family) => {
    const executeCommand = jest.fn(async () => noData(service));
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
      7000, 0, new CheckPilotCancellationToken(),
    );
    const receipt = await executor.executeCommand(planned(service, expectedResponse), 0, 100);
    expect(receipt.responses[0].envelope.kind).toBe('NO_DATA');
    expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
      command: service, family, expectedService: expectedResponse, timeoutMs: 7000,
    }));
    expect(executeCommand).toHaveBeenCalledTimes(1);
  });

  it('rejects protocol mismatch without issuing any ECU command', async () => {
    const executeCommand = jest.fn();
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
      1000, 0, new CheckPilotCancellationToken(),
    );
    const request = { ...planned('03', '43'), supportedProtocols: ['ISO_15765_CAN'] } as PlannedDiagnosticRequest;
    await expect(executor.executeCommand(request, 0, 0)).rejects.toThrow('CHECK_EXECUTOR_PROTOCOL_NOT_PROMOTED');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('rejects any subfunction and any parallel execution mode before dispatch', async () => {
    const executeCommand = jest.fn();
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
      1000, 0, new CheckPilotCancellationToken(),
    );
    await expect(executor.executeCommand({
      ...planned('03','43'), subfunction: 'FF',
    } as PlannedDiagnosticRequest, 0, 0)).rejects.toThrow('CHECK_EXECUTOR_SUBFUNCTION_NOT_PROMOTED');
    await expect(executor.executeCommand({
      ...planned('03','43'), executionMode: 'PARALLEL_ALLOWED',
    } as unknown as PlannedDiagnosticRequest, 0, 0)).rejects.toThrow('CHECK_EXECUTOR_NON_SERIAL_REQUEST');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('forbids concurrent Check commands on a single physical controller', async () => {
    const heldResult = held<ReturnType<typeof noData>>();
    const executeCommand = jest.fn().mockImplementationOnce(() => heldResult.promise).mockResolvedValue(noData());
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
      1000, 0, new CheckPilotCancellationToken(),
    );
    const first = executor.executeCommand(planned('03','43'), 0, 10);
    await expect(executor.executeCommand(planned('07','47'), 0, 11))
      .rejects.toThrow('CHECK_EXECUTOR_CONCURRENT_COMMAND');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    heldResult.resolve(noData());
    await first;
    const third = await executor.executeCommand(planned('07','47'), 0, 12);
    expect(third.responses).toHaveLength(1);
    expect(executeCommand).toHaveBeenCalledTimes(2);
  });

  it('blocks canceled Check during pacing and never issues another ECU request', async () => {
    jest.useFakeTimers();
    try {
      const cancel = new CheckPilotCancellationToken();
      const executeCommand = jest.fn(async () => noData());
      const executor = new RealCheckPlannedExecutor(
        { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
        1000, 600, cancel,
      );
      await executor.executeCommand(planned('03','43'), 0, 0);
      const second = executor.executeCommand(planned('07','47'), 0, 10);
      // Attach the rejection assertion BEFORE the fake clock advances:
      // otherwise Jest observes a transient unhandled promise rejection.
      const rejectsOnCancel = expect(second).rejects.toThrow('CHECK_CANCELLED');
      cancel.cancel();
      await jest.advanceTimersByTimeAsync(650);
      await rejectsOnCancel;
      expect(executeCommand).toHaveBeenCalledTimes(1);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('drops late in-flight ECU response when Check is cancelled and releases serial slot', async () => {
    const deferred = held<ReturnType<typeof noData>>();
    const cancel = new CheckPilotCancellationToken();
    const observer = jest.fn();
    const executeCommand = jest.fn()
      .mockImplementationOnce(() => deferred.promise)
      .mockResolvedValue(noData());
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
      1000, 0, cancel, observer,
    );
    const first = executor.executeCommand(planned('03','43'), 0, 100);
    const rejection = expect(first).rejects.toThrow('CHECK_CANCELLED');
    cancel.cancel();
    deferred.resolve(noData());
    await rejection;
    expect(observer).not.toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledTimes(1);
    await expect(executor.executeCommand(planned('07','47'), 1, 110))
      .rejects.toThrow('CHECK_CANCELLED');
  });

  it('fails closed if continuation is reached instead of retransmitting a pending command', async () => {
    const executeCommand = jest.fn();
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any, 'ISO_14230_KWP', 'physical-fixture',
      1000, 0, new CheckPilotCancellationToken(),
    );
    await expect(executor.awaitPendingContinuation(planned('03','43'), 0, 0, 300))
      .rejects.toThrow('CHECK_PENDING_CONTINUATION_NOT_PROMOTED');
    expect(executeCommand).not.toHaveBeenCalled();
  });


  it.each(['04', '08', '09', '22'])('never dispatches unallowlisted service %s', async service => {
    const executeCommand = jest.fn();
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any,
      'ISO_14230_KWP',
      'physical-fixture',
      1000,
      0,
      new CheckPilotCancellationToken(),
    );

    await expect(executor.executeCommand(planned(service, '44'), 0, 0))
      .rejects.toThrow(`CHECK_EXECUTOR_SERVICE_NOT_ALLOWLISTED:${service}`);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('does not dispatch after cancellation', async () => {
    const executeCommand = jest.fn();
    const cancellation = new CheckPilotCancellationToken();
    cancellation.cancel();
    const executor = new RealCheckPlannedExecutor(
      { executeCommand } as any,
      'ISO_14230_KWP',
      'physical-fixture',
      1000,
      0,
      cancellation,
    );

    await expect(executor.executeCommand(planned('03', '43'), 0, 0))
      .rejects.toThrow('CHECK_CANCELLED');
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
