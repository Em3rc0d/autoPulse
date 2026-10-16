import {
  canTransitionDiagnosticScan,
  isDiagnosticScanTerminal,
  transitionDiagnosticScan,
} from '../DiagnosticScanState';

describe('DiagnosticScanState', () => {
  it('follows the authorized linear state sequence', () => {
    expect(transitionDiagnosticScan('IDLE', 'CONNECTING')).toBe('CONNECTING');
    expect(transitionDiagnosticScan('CORRELATING', 'SEALING_REPORT')).toBe('SEALING_REPORT');
    expect(transitionDiagnosticScan('SEALING_REPORT', 'COMPLETE')).toBe('COMPLETE');
  });

  it('represents degraded terminal outcomes while retaining prior evidence', () => {
    expect(canTransitionDiagnosticScan('SCANNING_DTC', 'LIMITED')).toBe(true);
    expect(canTransitionDiagnosticScan('SCANNING_READINESS', 'CANCELLED')).toBe(true);
    expect(canTransitionDiagnosticScan('DISCOVERING_ECUS', 'DISCONNECTED')).toBe(true);
  });

  it('does not allow terminal states to transition', () => {
    expect(isDiagnosticScanTerminal('LIMITED')).toBe(true);
    expect(() => transitionDiagnosticScan('LIMITED', 'COMPLETE')).toThrow('Invalid diagnostic scan transition');
  });
});
