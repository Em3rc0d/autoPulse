import { RealObdInitialization } from '../RealObdInitialization';
import { RealObdController } from '../RealObdController';
import type { CommandRequest, CommandResult, RawElmResponse } from '../pipeline/types';

// Synthetic serial replies pass through the actual controller pipeline:
// normalizer -> classifier -> frame parser -> decoder -> initialization.
// No decoded-value or command-status mocks; Bluetooth hardware is not exercised.
async function runSerial(respond: (command: string, protocol: string) => string) {
  let protocol = '0';
  const requests: string[] = [];
  const controller = Object.create(RealObdController.prototype) as RealObdController;
  const pipeline = controller as unknown as {
    runPipeline(request: CommandRequest, raw: RawElmResponse): CommandResult;
  };
  controller.executeCommand = async request => {
    requests.push(request.command);
    if (request.command.startsWith('ATSP')) protocol = request.command.slice(4);
    const text = request.command === 'ATDPN' ? protocol :
      request.command === 'ATDP' ? 'ISO 14230-4 KWP' : respond(request.command, protocol);
    return pipeline.runPipeline(request, {
      fragments: [], accumulatedText: text + '\r>', completionReason: 'PROMPT_RECEIVED',
      startedAt: 0, finishedAt: 1, latencyMs: 1,
    });
  };
  return { snapshot: await new RealObdInitialization(controller, () => undefined).execute(), requests };
}

describe('Initialization with synthetic serial replies and the real OBD pipeline', () => {
  let log: jest.SpyInstance;
  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => log.mockRestore());

  it('accepts observed RPM and coolant despite a valid empty capability bitmap', async () => {
    const { snapshot } = await runSerial(command => {
      if (command === '0100') return '41 00 00 00 00 00';
      if (command === '010C') return '41 0C 0C 80'; // 800 rpm
      if (command === '0105') return '41 05 49'; // 33 C
      return command.startsWith('AT') ? 'OK' : 'NO DATA';
    });
    expect(snapshot.initializationSuccessful).toBe(true);
    expect(snapshot.directlyObservedPids).toEqual(expect.arrayContaining(['010C', '0105']));
    expect(snapshot.failureReason).toBeUndefined();
  });

  it('preserves KWP after negative capability replies when correlated RPM succeeds', async () => {
    const { snapshot, requests } = await runSerial((command, protocol) => {
      if (command === '0100') return '7F 01 12';
      if (command === '010C' && protocol === '5') return '41 0C 0C 80';
      return command.startsWith('AT') ? 'OK' : 'NO DATA';
    });
    expect(snapshot.initializationSuccessful).toBe(true);
    expect(snapshot.protocol).toBe('5');
    expect(snapshot.directlyObservedPids).toContain('010C');
    expect(requests.slice(requests.indexOf('ATSP5') + 1)).not.toContain('ATSP0');
  });

  it('does not promote stale speed replies or adapter voltage to RPM/ECU proof', async () => {
    const { snapshot } = await runSerial(command => {
      if (command === '010C') return '41 0D 00';
      if (command === 'ATRV') return '14.1V';
      return command.startsWith('AT') ? 'OK' : 'NO DATA';
    });
    expect(snapshot.initializationSuccessful).toBe(false);
    expect(snapshot.directlyObservedPids).toEqual([]);
    expect(snapshot.protocol).toBeNull();
  });
});
