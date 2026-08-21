import { AcceptProbedAdapter } from '../AcceptProbedAdapter';
import type { ProbeResult } from '../../../domain/telemetry/probe/ProbeResult';

const compatibleProbe = (overrides: Partial<ProbeResult> = {}): ProbeResult => ({
  verdict: 'SUPPORTED' as any,
  probeStage: 'FINISHED',
  profileMatch: 'NO_PROFILE_MATCH',
  compatibilityGrade: 'COMPATIBLE',
  compatibilityReasons: ['GENERIC_BEHAVIOR_VERIFIED'],
  connectionRetained: true,
  testedCombinationCount: 1,
  startedAt: 10,
  finishedAt: 20,
  deviceId: 'ble-device-1',
  deviceName: 'Generic OBD',
  rssi: -45,
  ...overrides,
});

describe('AcceptProbedAdapter', () => {
  it('persists adapter evidence before creating a Live session', async () => {
    const order: string[] = [];
    const adapterRegistration = {
      upsertAdapter: jest.fn(async () => {
        order.push('adapter');
        return { id: 'adapter-1' };
      }),
    };
    const adapterEvidence = {
      appendProbeResult: jest.fn(async () => {
        order.push('evidence');
      }),
    };
    const liveSessions = {
      createSession: jest.fn(async () => {
        order.push('session');
        return 'session-1';
      }),
    };

    const useCase = new AcceptProbedAdapter(adapterRegistration, adapterEvidence, liveSessions);
    const result = await useCase.execute({
      workspaceId: 'ws-1',
      operatorId: 'operator-1',
      vehicleId: 'vehicle-1',
      platformDeviceId: 'ble-device-1',
      adapterAlias: 'Generic OBD',
      probeResult: compatibleProbe(),
    });

    expect(order).toEqual(['adapter', 'evidence', 'session']);
    expect(result).toEqual({ adapterInstanceId: 'adapter-1', sessionId: 'session-1' });
  });

  it('does not create a session when capability evidence cannot be persisted', async () => {
    const adapterRegistration = {
      upsertAdapter: jest.fn(async () => ({ id: 'adapter-1' })),
    };
    const adapterEvidence = {
      appendProbeResult: jest.fn(async () => {
        throw new Error('DB_WRITE_FAILED');
      }),
    };
    const liveSessions = {
      createSession: jest.fn(async () => 'session-should-not-exist'),
    };

    const useCase = new AcceptProbedAdapter(adapterRegistration, adapterEvidence, liveSessions);

    await expect(useCase.execute({
      workspaceId: 'ws-1',
      operatorId: 'operator-1',
      vehicleId: 'vehicle-1',
      platformDeviceId: 'ble-device-1',
      adapterAlias: 'Generic OBD',
      probeResult: compatibleProbe(),
    })).rejects.toThrow('DB_WRITE_FAILED');

    expect(liveSessions.createSession).not.toHaveBeenCalled();
  });

  it('rejects an unsupported adapter before touching persistence', async () => {
    const adapterRegistration = { upsertAdapter: jest.fn() };
    const adapterEvidence = { appendProbeResult: jest.fn() };
    const liveSessions = { createSession: jest.fn() };

    const useCase = new AcceptProbedAdapter(adapterRegistration as any, adapterEvidence as any, liveSessions as any);

    await expect(useCase.execute({
      workspaceId: 'ws-1',
      operatorId: 'operator-1',
      vehicleId: 'vehicle-1',
      platformDeviceId: 'ble-device-1',
      adapterAlias: 'Broken OBD',
      probeResult: compatibleProbe({ compatibilityGrade: 'UNSUPPORTED' }),
    })).rejects.toThrow('ADAPTER_NOT_ACCEPTABLE_FOR_LIVE');

    expect(adapterRegistration.upsertAdapter).not.toHaveBeenCalled();
    expect(adapterEvidence.appendProbeResult).not.toHaveBeenCalled();
    expect(liveSessions.createSession).not.toHaveBeenCalled();
  });

  it('rejects a probe whose connection was not retained', async () => {
    const adapterRegistration = { upsertAdapter: jest.fn() };
    const adapterEvidence = { appendProbeResult: jest.fn() };
    const liveSessions = { createSession: jest.fn() };
    const useCase = new AcceptProbedAdapter(adapterRegistration as any, adapterEvidence as any, liveSessions as any);

    await expect(useCase.execute({
      workspaceId: 'ws-1',
      operatorId: 'operator-1',
      vehicleId: 'vehicle-1',
      platformDeviceId: 'ble-device-1',
      adapterAlias: 'Generic OBD',
      probeResult: compatibleProbe({ connectionRetained: false }),
    })).rejects.toThrow('ADAPTER_CONNECTION_NOT_RETAINED');

    expect(liveSessions.createSession).not.toHaveBeenCalled();
  });
});
