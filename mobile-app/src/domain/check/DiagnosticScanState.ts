export const DIAGNOSTIC_SCAN_ACTIVE_STATES = [
  'IDLE',
  'CONNECTING',
  'IDENTIFYING_CONNECTOR',
  'DISCOVERING_PROTOCOL',
  'DISCOVERING_ECUS',
  'DISCOVERING_CAPABILITIES',
  'SCANNING_DTC',
  'SCANNING_READINESS',
  'SCANNING_FREEZE_FRAME',
  'SCANNING_MONITORS',
  'PLANNING_EVIDENCE',
  'ACQUIRING_TARGETED_PIDS',
  'CORRELATING',
  'SEALING_REPORT',
] as const;

export const DIAGNOSTIC_SCAN_TERMINAL_STATES = [
  'COMPLETE',
  'LIMITED',
  'CANCELLED',
  'FAILED',
  'DISCONNECTED',
] as const;

export type DiagnosticScanActiveState = typeof DIAGNOSTIC_SCAN_ACTIVE_STATES[number];
export type DiagnosticScanTerminalState = typeof DIAGNOSTIC_SCAN_TERMINAL_STATES[number];
export type DiagnosticScanState = DiagnosticScanActiveState | DiagnosticScanTerminalState;

const LINEAR_NEXT: Readonly<Partial<Record<DiagnosticScanActiveState, DiagnosticScanState>>> = {
  IDLE: 'CONNECTING',
  CONNECTING: 'IDENTIFYING_CONNECTOR',
  IDENTIFYING_CONNECTOR: 'DISCOVERING_PROTOCOL',
  DISCOVERING_PROTOCOL: 'DISCOVERING_ECUS',
  DISCOVERING_ECUS: 'DISCOVERING_CAPABILITIES',
  DISCOVERING_CAPABILITIES: 'SCANNING_DTC',
  SCANNING_DTC: 'SCANNING_READINESS',
  SCANNING_READINESS: 'SCANNING_FREEZE_FRAME',
  SCANNING_FREEZE_FRAME: 'SCANNING_MONITORS',
  SCANNING_MONITORS: 'PLANNING_EVIDENCE',
  PLANNING_EVIDENCE: 'ACQUIRING_TARGETED_PIDS',
  ACQUIRING_TARGETED_PIDS: 'CORRELATING',
  CORRELATING: 'SEALING_REPORT',
  SEALING_REPORT: 'COMPLETE',
};

export function isDiagnosticScanTerminal(state: DiagnosticScanState): state is DiagnosticScanTerminalState {
  return (DIAGNOSTIC_SCAN_TERMINAL_STATES as readonly string[]).includes(state);
}

export function canTransitionDiagnosticScan(from: DiagnosticScanState, to: DiagnosticScanState): boolean {
  if (isDiagnosticScanTerminal(from) || from === to) return false;
  if (to === 'CANCELLED' || to === 'FAILED' || to === 'DISCONNECTED') return true;
  if (to === 'LIMITED') return from !== 'IDLE';
  return LINEAR_NEXT[from] === to;
}

export function transitionDiagnosticScan(from: DiagnosticScanState, to: DiagnosticScanState): DiagnosticScanState {
  if (!canTransitionDiagnosticScan(from, to)) {
    throw new Error(`Invalid diagnostic scan transition: ${from} -> ${to}`);
  }
  return to;
}
