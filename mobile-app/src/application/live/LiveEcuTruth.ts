export type LiveEcuTruthState =
  | 'WAITING_FOR_FIRST_ECU_SAMPLE'
  | 'ECU_DATA_DELAYED'
  | 'CONNECTION_RECOVERING'
  | 'LIVE_ECU_DATA'
  | 'RECORDING_DEGRADED';

export interface LiveEcuTruthInput {
  hasValidEcuSample: boolean;
  elapsedMs: number;
  sessionError?: string | null;
  delayedAfterMs?: number;
}

export interface LiveEcuTruthPresentation {
  state: LiveEcuTruthState;
  label: string;
  detail: string;
  tone: 'waiting' | 'delayed' | 'live' | 'error';
}

export const DEFAULT_FIRST_ECU_SAMPLE_DELAY_MS = 90_000;
const INTERRUPTED_PREFIX = 'SESSION_INTERRUPTED:';
const RECOVERING_PREFIX = 'SESSION_RECOVERING:';

function interruptionDetail(sessionError: string): string {
  const reason = sessionError.slice(INTERRUPTED_PREFIX.length).trim() || 'UNKNOWN';
  return `The Live session ended unexpectedly (${reason.replace(/_/g, ' ')}). Persisted evidence remains available in Session Summary.`;
}

function recoveryDetail(sessionError: string): string {
  const reason = sessionError.slice(RECOVERING_PREFIX.length).trim() || 'CONNECTION_LOST';
  return `Vehicle data paused (${reason.replace(/_/g, ' ')}). AutoPulse is retrying the same adapter and ECU path.`;
}

export function deriveLiveEcuTruth({
  hasValidEcuSample,
  elapsedMs,
  sessionError,
  delayedAfterMs = DEFAULT_FIRST_ECU_SAMPLE_DELAY_MS,
}: LiveEcuTruthInput): LiveEcuTruthPresentation {
  if (sessionError?.startsWith(RECOVERING_PREFIX)) {
    return {
      state: 'CONNECTION_RECOVERING',
      label: 'RECONNECTING',
      detail: recoveryDetail(sessionError),
      tone: 'delayed',
    };
  }

  if (sessionError) {
    const interrupted = sessionError.startsWith(INTERRUPTED_PREFIX);
    return {
      state: 'RECORDING_DEGRADED',
      label: interrupted ? 'SESSION INTERRUPTED' : 'RECORDING DEGRADED',
      detail: interrupted ? interruptionDetail(sessionError) : sessionError,
      tone: 'error',
    };
  }

  if (hasValidEcuSample) {
    return {
      state: 'LIVE_ECU_DATA',
      label: 'LIVE · ECU DATA',
      detail: 'At least one valid ECU-origin observation has been received.',
      tone: 'live',
    };
  }

  if (elapsedMs >= delayedAfterMs) {
    return {
      state: 'ECU_DATA_DELAYED',
      label: 'ECU DATA DELAYED',
      detail: 'The adapter is connected, but AutoPulse has not received a valid ECU sample yet.',
      tone: 'delayed',
    };
  }

  return {
    state: 'WAITING_FOR_FIRST_ECU_SAMPLE',
    label: 'CONNECTED · WAITING FOR ECU DATA',
    detail: 'The session is connected while AutoPulse waits for the first valid ECU observation.',
    tone: 'waiting',
  };
}

export function commandResultContainsValidEcuSample(result: {
  status?: string | null;
  request?: { family?: string | null } | null;
  decodedValues?: ReadonlyArray<{ value?: unknown }> | null;
}): boolean {
  if (result.status !== 'SUCCESS_DECODED') return false;
  if (!result.request?.family?.startsWith('OBD_MODE_')) return false;

  // Live state is unlocked only by finite numeric ECU evidence. Capability bitmaps,
  // strings, arrays, NaN and Infinity may be valid decoder artifacts elsewhere, but
  // they are not a live driving observation and must not make the UI claim LIVE ECU DATA.
  return Boolean(result.decodedValues?.some(decoded =>
    typeof decoded.value === 'number' && Number.isFinite(decoded.value)
  ));
}
