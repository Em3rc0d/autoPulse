import type { ObdAcquisitionEvent } from '../../domain/telemetry/models/ObdAcquisitionEvent';
import { LIVE_OBD_REQUEST_ORDER } from '../../domain/obd/LiveObdPollingPolicy';

/**
 * ROAD TEST-001: offline, pure and deterministic. No BLE reads, timers,
 * persistence writes, network calls or UI side effects.
 *
 * Only bounded ECU Mode 01 requests are eligible. ATRV is adapter evidence,
 * not PID 0142. V3 event commands are reconstructed from binary dictionaries:
 * unknown/unattributable commands must never be guessed into a supported PID.
 */
export const ROAD_TEST_PIDS = LIVE_OBD_REQUEST_ORDER;
export type RoadTestPid = typeof ROAD_TEST_PIDS[number];
export type RoadTestMetricsTrust = 'COMPLETE' | 'DEGRADED' | 'UNAVAILABLE';

export interface Distribution {
  readonly n: number;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
}

export interface RoadTestPidMetric {
  readonly requestId: RoadTestPid;
  readonly attempts: number;
  readonly validResponses: number;
  readonly validReadings: number;
  readonly outcomes: Readonly<Record<string, number>>;
  readonly responseYieldPercent: number | null;
  readonly responseLatencyMs: Distribution;
  readonly validUpdateIntervalMs: Distribution;
}

const SAFE_SIGNAL: Readonly<Record<RoadTestPid, { label: string; unit: string }>> = {
  '0105': { label: 'COOLANT', unit: '°C' },
  '010D': { label: 'SPEED', unit: 'km/h' },
  '010C': { label: 'RPM', unit: 'RPM' },
  '0104': { label: 'ENGINE_LOAD', unit: '%' },
  '0111': { label: 'THROTTLE_POSITION', unit: '%' },
  '0142': { label: 'ECU_VOLTAGE', unit: 'V' },
};

export interface SafeRoadTestEvent {
  readonly sequence: number;
  readonly command: RoadTestPid;
  readonly requestedAt: number;
  readonly completedAt: number;
  readonly status: string;
  readonly latencyMs: number | null;
  readonly values: readonly {
    readonly signal: string;
    readonly value: number;
    readonly unit: string;
  }[];
}

export interface RoadTestMetricsResult {
  readonly schemaVersion: 1;
  readonly phase: 'FULL_SESSION_UNSEGMENTED';
  readonly trust: RoadTestMetricsTrust;
  readonly issues: readonly string[];
  readonly totalEligibleAttempts: number;
  readonly perPid: readonly RoadTestPidMetric[];
  readonly safeEvents: readonly SafeRoadTestEvent[];
}

const PID_SET = new Set<string>(ROAD_TEST_PIDS);
const safeTimestamp = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

function nearestRank(values: readonly number[]): Distribution {
  const sorted = values.filter(value => Number.isFinite(value) && value >= 0)
    .slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { n: 0, p50: null, p95: null, max: null };
  return Object.freeze({
    n,
    p50: sorted[Math.ceil(n * 0.5) - 1],
    p95: sorted[Math.ceil(n * 0.95) - 1],
    max: sorted[n - 1],
  });
}

function matchingReadings(event: ObdAcquisitionEvent, pid: RoadTestPid) {
  return event.decodedReadings.filter(reading =>
    reading.origin === 'OBD2'
    && reading.service.toUpperCase() === '01'
    && reading.pid?.toUpperCase() === pid.slice(2)
    && (reading.quality === 'GOOD' || (reading.quality as string) === 'VALID')
    && typeof reading.value === 'number'
    && Number.isFinite(reading.value)
    && safeTimestamp(reading.observedAt),
  );
}

export function calculateRoadTestMetrics(
  events: readonly ObdAcquisitionEvent[],
  upstreamIssues: readonly string[] = [],
): RoadTestMetricsResult {
  const issues = new Set<string>(upstreamIssues);
  const seen = new Set<number>();
  const perPid = ROAD_TEST_PIDS.map(requestId => ({
    requestId,
    attempts: 0,
    validResponses: 0,
    validReadings: 0,
    outcomes: {} as Record<string, number>,
    latencies: [] as number[],
    observedAt: [] as number[],
  }));
  const index = new Map<string, typeof perPid[number]>(
    perPid.map(record => [record.requestId, record]),
  );
  const safeEvents: SafeRoadTestEvent[] = [];
  const ordered = [...events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  let lastSequence: number | null = null;
  let lastCompleted: number | null = null;

  for (const event of ordered) {
    if (!Number.isSafeInteger(event.sequenceNumber) || event.sequenceNumber < 1) {
      issues.add('INVALID_EVENT_SEQUENCE');
      continue;
    }
    if (seen.has(event.sequenceNumber)) {
      issues.add('DUPLICATE_EVENT_SEQUENCE');
      continue;
    }
    seen.add(event.sequenceNumber);
    if (lastSequence === null && event.sequenceNumber !== 1) issues.add('EVENT_SEQUENCE_GAP');
    if (lastSequence !== null && event.sequenceNumber !== lastSequence + 1) issues.add('EVENT_SEQUENCE_GAP');
    lastSequence = event.sequenceNumber;

    const timestampsValid = safeTimestamp(event.requestedAt)
      && safeTimestamp(event.completedAt)
      && event.completedAt >= event.requestedAt;
    if (!timestampsValid) issues.add('INVALID_EVENT_TIMESTAMPS');
    if (timestampsValid && lastCompleted !== null && event.completedAt < lastCompleted) {
      issues.add('OUT_OF_ORDER_COMPLETION_TIMESTAMPS');
    }
    if (timestampsValid) lastCompleted = event.completedAt;

    const command = event.command?.trim().toUpperCase();
    if (!command || !PID_SET.has(command) || !/^01[0-9A-F]{2}$/.test(command)) continue;
    const pid = command as RoadTestPid;
    const metric = index.get(pid)!;
    metric.attempts++;
    const outcome = event.status || 'UNKNOWN';
    metric.outcomes[outcome] = (metric.outcomes[outcome] ?? 0) + 1;
    if (!Number.isFinite(event.latencyMs) || event.latencyMs < 0) {
      issues.add('INVALID_STORED_LATENCY');
    } else if (timestampsValid) {
      metric.latencies.push(event.latencyMs);
    }

    const readings = timestampsValid && outcome === 'SUCCESS'
      ? matchingReadings(event, pid)
      : [];
    if (event.decodedReadings.some(reading =>
      reading.service.toUpperCase() === '01'
      && reading.pid?.toUpperCase() === pid.slice(2)
      && (reading.quality === 'GOOD' || (reading.quality as string) === 'VALID')
      && (typeof reading.value !== 'number' || !Number.isFinite(reading.value))
    )) issues.add('INVALID_GOOD_READING');

    if (readings.length > 0) {
      metric.validResponses++;
      metric.validReadings += readings.length;
      // Per-command freshness: a multi-signal or multi-ECU reply occupies
      // exactly one update time. Never pretend it sampled multiple times.
      metric.observedAt.push(Math.max(...readings.map(reading => reading.observedAt)));
    }
    safeEvents.push(Object.freeze({
      sequence: event.sequenceNumber,
      command: pid,
      requestedAt: timestampsValid ? event.requestedAt : -1,
      completedAt: timestampsValid ? event.completedAt : -1,
      status: outcome,
      latencyMs: Number.isFinite(event.latencyMs) && event.latencyMs >= 0 && timestampsValid
        ? event.latencyMs : null,
      values: Object.freeze(readings.map(reading => Object.freeze({
        // Restrict signal name and unit to a bounded, non-identifying label.
        signal: SAFE_SIGNAL[pid].label,
        value: reading.value as number,
        unit: SAFE_SIGNAL[pid].unit,
      }))),
    }));
  }

  const metrics: RoadTestPidMetric[] = perPid.map(entry => {
    const observed = entry.observedAt.slice().sort((a, b) => a - b);
    const intervals: number[] = [];
    for (let i = 1; i < observed.length; i++) intervals.push(observed[i] - observed[i - 1]);
    return Object.freeze({
      requestId: entry.requestId,
      attempts: entry.attempts,
      validResponses: entry.validResponses,
      validReadings: entry.validReadings,
      outcomes: Object.freeze({ ...entry.outcomes }),
      responseYieldPercent: entry.attempts > 0
        ? Math.round((entry.validResponses / entry.attempts) * 10000) / 100
        : null,
      responseLatencyMs: nearestRank(entry.latencies),
      validUpdateIntervalMs: nearestRank(intervals),
    });
  });

  return Object.freeze({
    schemaVersion: 1 as const,
    phase: 'FULL_SESSION_UNSEGMENTED' as const,
    trust: issues.size > 0 ? 'DEGRADED' as const
      : safeEvents.length === 0 ? 'UNAVAILABLE' as const
      : 'COMPLETE' as const,
    issues: Object.freeze([...issues].sort()),
    totalEligibleAttempts: safeEvents.length,
    perPid: Object.freeze(metrics),
    safeEvents: Object.freeze(safeEvents),
  });
}
