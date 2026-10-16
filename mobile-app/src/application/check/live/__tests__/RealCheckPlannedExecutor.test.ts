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
