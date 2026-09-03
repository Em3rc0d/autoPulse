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

  it('shows bounded connection recovery as amber instead of terminal failure', () => {
    const state = deriveLiveEcuTruth({
      hasValidEcuSample: true,
      elapsedMs: 12_000,
      sessionError: 'SESSION_RECOVERING:ECU_RESPONSE_LOST',
    });

    expect(state.state).toBe('CONNECTION_RECOVERING');
    expect(state.label).toBe('RECONNECTING');
    expect(state.detail).toContain('ECU RESPONSE LOST');
    expect(state.tone).toBe('delayed');
  });

  it('lets recording failure override live state', () => {
    expect(deriveLiveEcuTruth({
      hasValidEcuSample: true,
      elapsedMs: 2_000,
      sessionError: 'SQLITE_WRITE_FAILED',
    }).state).toBe('RECORDING_DEGRADED');
  });

  it('labels terminal interruption explicitly and points to persisted evidence', () => {
    const state = deriveLiveEcuTruth({
      hasValidEcuSample: true,
      elapsedMs: 10_000,
      sessionError: 'SESSION_INTERRUPTED:DEVICE_DISCONNECTED',
    });

    expect(state.label).toBe('SESSION INTERRUPTED');
    expect(state.detail).toContain('DEVICE DISCONNECTED');
    expect(state.detail).toContain('Session Summary');
    expect(state.tone).toBe('error');
  });

  it('accepts finite decoded OBD observations as ECU samples', () => {
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

  it('rejects nonnumeric and non-finite decoder artifacts as live driving evidence', () => {
    const base = {
      status: 'SUCCESS_DECODED',
      request: { family: 'OBD_MODE_01' },
    };

    expect(commandResultContainsValidEcuSample({ ...base, decodedValues: [{ value: ['010C', '010D'] }] })).toBe(false);
    expect(commandResultContainsValidEcuSample({ ...base, decodedValues: [{ value: '838' }] })).toBe(false);
    expect(commandResultContainsValidEcuSample({ ...base, decodedValues: [{ value: Number.NaN }] })).toBe(false);
    expect(commandResultContainsValidEcuSample({ ...base, decodedValues: [{ value: Number.POSITIVE_INFINITY }] })).toBe(false);
  });
});
