import { RealObdInitialization } from '../RealObdInitialization';
import type { RealObdController } from '../RealObdController';
import type { CommandRequest, CommandResult, ObdFrame } from '../pipeline/types';

jest.mock('../RealObdController', () => ({ RealObdController: jest.fn() }));

function result(request: CommandRequest, frames: ObdFrame[] = [], text = 'OK'): CommandResult {
  return {
    request, rawResponse: null,
    normalizedResponse: { rawText: text, normalizedText: text, echoLines: [],
      statusLines: [], candidateHexLines: [], unknownLines: [], promptDetected: true },
    classifiedLines: [], obdFrames: frames, negativeResponses: [], decodedValues: [],
    status: 'SUCCESS_RAW', errors: [], latencyMs: 1,
  };
}
const bitmap: ObdFrame = {
  sourceAddress: null, service: '41', pid: '00', payloadBytes: [0, 16, 0, 0],
  declaredLength: null, rawLine: '410000100000', validity: 'VALID',
};

async function discover(respond: (request: CommandRequest) => CommandResult) {
  const executeCommand = jest.fn(async (request: CommandRequest) => respond(request));
  const controller = { executeCommand } as unknown as RealObdController;
  const snapshot = await new RealObdInitialization(controller, () => undefined).execute();
  return { snapshot, requests: executeCommand.mock.calls.map(([request]) => request) };
}

describe('RealObdInitialization negotiation evidence', () => {
  it('continues protocol discovery after a raw negative response without a bitmap', async () => {
    let attempts = 0;
    const { snapshot, requests } = await discover(request => {
      if (request.command === '0100') {
        attempts += 1;
        return result(request, attempts === 1 ? [] : [bitmap]);
      }
      return result(request, [], request.command === 'ATDPN' ? '6' : 'OK');
    });
    expect(attempts).toBe(2);
    expect(requests.some(request => request.command === 'ATSP6')).toBe(true);
    expect(snapshot.initializationSuccessful).toBe(true);
    expect(snapshot.failureReason).toBeUndefined();
    expect(requests.filter(request => request.family === 'OBD_MODE_01')
      .every(request => request.expectedPid === request.command.slice(2))).toBe(true);
  });

  it('restores automatic negotiation after every forced protocol fails', async () => {
    const { snapshot, requests } = await discover(request => result(request));
    const lastForced = requests.findIndex(request => request.command === 'ATSP5');
    expect(lastForced).toBeGreaterThan(0);
    expect(requests.slice(lastForced + 1, lastForced + 4).map(request => request.command))
      .toEqual(['0100', 'ATSP0', '0105']);
    expect(requests.find(request => request.command === '0105')?.timeoutMs).toBe(15000);
    expect(requests.find(request => request.command === '010D')?.timeoutMs).toBe(4000);
    expect(snapshot.initializationSuccessful).toBe(false);
    expect(snapshot.protocol).toBeNull();
    expect(snapshot.failureReason).toBe('NO_VALID_MODE_01_CAPABILITY_BITMAP');
  });

  it('rejects a malformed or unrelated frame as capability proof', async () => {
    let attempts = 0;
    const { snapshot } = await discover(request => {
      if (request.command === '0100') {
        attempts += 1;
        return result(request, [{ ...bitmap, validity: 'INCOMPLETE' }]);
      }
      return result(request);
    });
    expect(attempts).toBe(8);
    expect(snapshot.initializationSuccessful).toBe(false);
  });
});
