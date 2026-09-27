import {
  checkErrorMessage,
  isRecoverableCheckTransportFailure,
} from '../CheckTransportRecovery';

describe('CheckTransportRecovery', () => {
  it.each([
    'CHECK_ADAPTER_SETUP_FAILED:ATE0:TIMEOUT',
    'CHECK_STANDARD_OBD_UNREACHABLE:TIMEOUT',
    'CHECK_STANDARD_OBD_UNREACHABLE:DISCONNECTED',
    'CHECK_PROTOCOL_UNRESOLVED:NO_EVIDENCE',
  ])('allows one transport rebuild for startup-path failure %s', message => {
    expect(isRecoverableCheckTransportFailure(new Error(message))).toBe(true);
  });

  it.each([
    'CHECK_PLAN_BLOCKED:descriptor',
    'CHECK_CANCELLED',
    'some arbitrary UI failure',
  ])('does not broaden recovery to semantic/safety failure %s', message => {
    expect(isRecoverableCheckTransportFailure(new Error(message))).toBe(false);
  });

  it('normalizes unknown thrown values for evidence', () => {
    expect(checkErrorMessage('raw failure')).toBe('raw failure');
  });
});
