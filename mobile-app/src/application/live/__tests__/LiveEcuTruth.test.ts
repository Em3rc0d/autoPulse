import {
  commandResultContainsValidEcuSample,
  deriveLiveEcuTruth,
} from '../LiveEcuTruth';

describe('LiveEcuTruth', () => {
  it('does not claim live ECU data before the first valid ECU observation', () => {
    expect(deriveLiveEcuTruth({ hasValidEcuSample: false, elapsedMs: 12_000 }).state)
      .toBe('WAITING_FOR_FIRST_ECU_SAMPLE');
  });

  it('marks a long first-sample wait as delayed without inventing data', () => {
    expect(deriveLiveEcuTruth({ hasValidEcuSample: false, elapsedMs: 95_000 }).state)
      .toBe('ECU_DATA_DELAYED');
  });

  it('claims live only after a valid ECU-origin sample', () => {
    expect(deriveLiveEcuTruth({ hasValidEcuSample: true, elapsedMs: 2_000 }).state)
      .toBe('LIVE_ECU_DATA');
  });

  it('lets recording failure override live state', () => {
    expect(deriveLiveEcuTruth({
      hasValidEcuSample: true,
      elapsedMs: 2_000,
      sessionError: 'SQLITE_WRITE_FAILED',
    }).state).toBe('RECORDING_DEGRADED');
  });

  it('accepts decoded OBD observations as ECU samples', () => {
    expect(commandResultContainsValidEcuSample({
      status: 'SUCCESS_DECODED',
      request: { family: 'OBD_MODE_01' },
      decodedValues: [{ value: 838 }],
    })).toBe(true);
  });

  it('does not let adapter AT voltage unlock ECU live state', () => {
    expect(commandResultContainsValidEcuSample({
      status: 'SUCCESS_DECODED',
      request: { family: 'ELM_AT' },
      decodedValues: [{ value: 14.3 }],
    })).toBe(false);
  });
});
