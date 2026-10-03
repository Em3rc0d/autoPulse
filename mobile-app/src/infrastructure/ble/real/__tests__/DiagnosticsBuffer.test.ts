import { DiagnosticsBuffer } from '../DiagnosticsBuffer';
import type { CommandResult } from '../pipeline/types';

const result = (): CommandResult => ({
  request: {
    id: 'diag-010d',
    command: '010D',
    family: 'OBD_MODE_01',
    expectedService: '41',
    expectedPid: '0D',
    timeoutMs: 1500,
  },
  rawResponse: null,
  normalizedResponse: null,
  classifiedLines: [],
  obdFrames: [],
  negativeResponses: [],
  decodedValues: [],
  status: 'TIMEOUT',
  errors: [],
  latencyMs: 1500,
});

describe('DiagnosticsBuffer', () => {
  afterEach(() => DiagnosticsBuffer.clear());

  it('timestamps physical command outcomes for PID gap reconstruction', () => {
    DiagnosticsBuffer.push(result(), 1_234);

    expect(DiagnosticsBuffer.getHistory()).toEqual([
      expect.objectContaining({
        observedAt: 1_234,
        status: 'TIMEOUT',
        request: expect.objectContaining({ command: '010D' }),
      }),
    ]);
  });
});
