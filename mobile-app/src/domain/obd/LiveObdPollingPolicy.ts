export const LIVE_OBD_REQUEST_ORDER = Object.freeze([
  '0105', // coolant: safety/thermal state
  '010D', // vehicle speed: motion state
  '010C', // engine speed
  '0104', // calculated engine load
  '0111', // throttle position
  '0142', // control-module voltage
] as const);

export type LiveObdRequestId = typeof LIVE_OBD_REQUEST_ORDER[number];

export interface LivePollingPlan {
  requestIds: LiveObdRequestId[];
  fallbackProbe: boolean;
}

const LIVE_REQUEST_SET = new Set<string>(LIVE_OBD_REQUEST_ORDER);

export function normalizeObdRequestId(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * Live is deliberately narrower than the full capability catalog. A weak link
 * must not spend its freshness budget polling signals that Driving View v2 does
 * not consume. Capability evidence remains persisted separately.
 *
 * If discovery yielded none of the bounded live signals, the plan probes the
 * bounded set. Those probes are evidence-seeking only and must never be
 * persisted as advertised support until a decoder success is observed.
 */
export function resolveLivePollingPlan(discoveredRequests: readonly string[]): LivePollingPlan {
  const discovered = new Set(
    discoveredRequests
      .map(normalizeObdRequestId)
      .filter(requestId => LIVE_REQUEST_SET.has(requestId)),
  );

  const requestIds = LIVE_OBD_REQUEST_ORDER.filter(requestId => discovered.has(requestId));
  if (requestIds.length > 0) {
    return { requestIds: [...requestIds], fallbackProbe: false };
  }

  return { requestIds: [...LIVE_OBD_REQUEST_ORDER], fallbackProbe: true };
}

export function withProvenAdapterVoltage(
  requestIds: readonly string[],
  adapterVoltageProven: boolean,
): string[] {
  const normalized = Array.from(new Set(
    requestIds.map(normalizeObdRequestId).filter(Boolean),
  ));
  if (adapterVoltageProven && !normalized.includes('ATRV')) normalized.push('ATRV');
  return normalized;
}
