jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    currentState: 'active',
  },
}));

import { RealLiveSessionController } from '../RealLiveSessionController';

const createController = (supportedPids: string[], pollAdapterVoltage = false) => new RealLiveSessionController(
  {} as any,
  {} as any,
  'ws1',
  'session-1',
  'connection-1',
  supportedPids,
  pollAdapterVoltage,
);

describe('RealLiveSessionController polling contract', () => {
  it('adds ATRV only when adapter voltage capability was already proven', () => {
    const withoutAdapter = createController(['010C', '0104'], false);
    const withAdapter = createController(['010C', '0104'], true);

    expect((withoutAdapter as any).livePollRequests()).toEqual(['010C', '0104']);
    expect((withAdapter as any).livePollRequests()).toEqual(['010C', '0104', 'ATRV']);
  });

  it('does not duplicate ATRV when it is already present', () => {
    const controller = createController(['010C', 'atrv'], true);
    expect((controller as any).livePollRequests()).toEqual(['010C', 'ATRV']);
  });

  it('drops unrelated catalog signals from the live freshness budget', () => {
    const controller = createController(['010B', '0110', '0105', '0111', '010D']);
    expect((controller as any).livePollRequests()).toEqual(['0105', '010D', '0111']);
  });

  it('uses bounded evidence-seeking probes when discovery produced no driver signal', () => {
    const controller = createController(['010B', '0110']);
    expect((controller as any).livePollRequests()).toEqual([
      '0105', '010D', '010C', '0104', '0111', '0142',
    ]);
  });

  it('classifies a hard disconnect as DEVICE_DISCONNECTED recovery', async () => {
    const controller = createController(['010C']);
    (controller as any).currentState = 'ACTIVE';
    const recovery = jest.spyOn(controller, 'attemptConnectionRecovery').mockResolvedValue(true);
    const connection = {} as any;

    (controller as any).handlePollerDiagnostic({
      type: 'TRANSPORT_STALLED',
      pid: '010C',
      reason: 'DISCONNECTED',
      consecutiveFailures: 3,
    }, connection);

    await Promise.resolve();
    expect(recovery).toHaveBeenCalledWith('DEVICE_DISCONNECTED', connection);
  });

  it('classifies timeout/write stalls as ECU_RESPONSE_LOST recovery', async () => {
    const controller = createController(['010C']);
    (controller as any).currentState = 'ACTIVE';
    const recovery = jest.spyOn(controller, 'attemptConnectionRecovery').mockResolvedValue(true);
    const connection = {} as any;

    (controller as any).handlePollerDiagnostic({
      type: 'TRANSPORT_STALLED',
      pid: '010C',
      reason: 'TIMEOUT',
      consecutiveFailures: 3,
    }, connection);

    await Promise.resolve();
    expect(recovery).toHaveBeenCalledWith('ECU_RESPONSE_LOST', connection);
  });
});
