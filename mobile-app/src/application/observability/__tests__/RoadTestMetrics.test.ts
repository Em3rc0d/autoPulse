import type { ObdAcquisitionEvent } from '../../../domain/telemetry/models/ObdAcquisitionEvent';
import { calculateRoadTestMetrics } from '../RoadTestMetrics';

function event(sequence: number, command: string, status = 'SUCCESS', time = 1000,
  latencyMs = 100, value: number | null = 750): ObdAcquisitionEvent {
  const pid = command.slice(2);
  return {
    sessionId: 'test-private-session',
    sequenceNumber: sequence,
    requestId: 'private-identifier',
    command,
    commandFamily: command.startsWith('01') ? 'OBD_MODE_01' : 'ELM_AT',
    requestedAt: time - latencyMs,
    completedAt: time,
    completionReason: 'PROMPT_RECEIVED',
    latencyMs,
    rawFragments: [{ receivedAt: time, decodedText: 'VIN_PRIVATE_RAW_DO_NOT_EXPORT' }],
    rawText: 'VIN_PRIVATE_RAW_DO_NOT_EXPORT',
    frames: [],
    negativeResponses: [],
    status: status as ObdAcquisitionEvent['status'],
    warnings: [],
    decodedReadings: value === null ? [] : [{
      signalId: 'RPM',
      service: '41',
      pid,
      value,
      unit: 'rpm',
      rawBytes: [1, 2],
      origin: 'OBD2',
      quality: 'GOOD',
      sourceEcu: '7E8',
      observedAt: time,
    }],
  };
}

describe('ROAD TEST-001 deterministic observability', () => {
  it('calculates true nearest-rank p50/p95 and valid update intervals only from ECU evidence', () => {
    const events = Array.from({ length: 20 }, (_, i) => event(i + 1, '010C', 'SUCCESS', 1000 + i * 200, (i + 1) * 10));
    const data = calculateRoadTestMetrics(events);
    const rpm = data.perPid.find(row => row.requestId === '010C')!;
    expect(rpm.attempts).toBe(20);
    expect(rpm.validResponses).toBe(20);
    expect(rpm.validReadings).toBe(20);
    expect(rpm.responseYieldPercent).toBe(100);
    expect(rpm.responseLatencyMs).toEqual({ n: 20, p50: 100, p95: 190, max: 200 });
    expect(rpm.validUpdateIntervalMs).toEqual({ n: 19, p50: 200, p95: 200, max: 200 });
    expect(data.trust).toBe('COMPLETE');
  });

  it('uses valid zero speed rather than conflating it with missing speed', () => {
    const data = calculateRoadTestMetrics([
      event(1, '010D', 'SUCCESS', 1000, 100, 0),
      event(2, '010D', 'NO_DATA', 1300, 100, null),
      event(3, '010D', 'TIMEOUT', 1600, 100, null),
      event(4, '010D', 'SUCCESS', 2000, 100, 25),
    ]);
    const speed = data.perPid.find(row => row.requestId === '010D')!;
    expect(speed.attempts).toBe(4);
    expect(speed.validResponses).toBe(2);
    expect(speed.validReadings).toBe(2);
    expect(speed.responseYieldPercent).toBe(50);
    expect(speed.outcomes).toEqual({ SUCCESS: 2, NO_DATA: 1, TIMEOUT: 1 });
    expect(speed.validUpdateIntervalMs).toEqual({ n: 1, p50: 1000, p95: 1000, max: 1000 });
    expect(data.safeEvents[0].values[0].value).toBe(0);
    expect(data.safeEvents[1].values).toHaveLength(0);
  });

  it('never promotes ATRV, raw fragments, VIN, or an unapproved PID into local export', () => {
    const data = calculateRoadTestMetrics([
      event(1, 'ATRV', 'SUCCESS', 1000, 100, 14),
      event(2, '0110', 'SUCCESS', 1100, 100, 25),
      event(3, '0105', 'SUCCESS', 1200, 100, 70),
    ]);
    expect(data.totalEligibleAttempts).toBe(1);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('VIN_PRIVATE');
    expect(serialized).not.toContain('test-private-session');
    expect(serialized).not.toContain('ATRV');
    expect(data.perPid).toHaveLength(6);
  });

  it('reconciles the October Logan-shaped 100-event trace without treating ATRV as ECU PID 0142', () => {
    const commands = ['010D', '010C', '0104', '0111', 'ATRV'];
    const events = Array.from({ length: 100 }, (_, i) => {
      const command = commands[i % commands.length];
      const specimen = event(i + 1, command, 'SUCCESS', 1000 + i * 600, 300,
        command === '010D' ? 0 : command === '010C' ? 760 : command === 'ATRV' ? 14.2 : 42);
      if (command !== 'ATRV') return specimen;
      return { ...specimen, decodedReadings: specimen.decodedReadings.map(reading => ({
        ...reading, signalId: 'ADAPTER_VOLTAGE', service: 'AT', pid: null,
      })) };
    });
    const result = calculateRoadTestMetrics(events);
    expect(result.trust).toBe('COMPLETE');
    expect(result.totalEligibleAttempts).toBe(80);
    for (const pid of ['010D', '010C', '0104', '0111']) {
      const metric = result.perPid.find(item => item.requestId === pid)!;
      expect(metric.attempts).toBe(20);
      expect(metric.validResponses).toBe(20);
      expect(metric.validReadings).toBe(20);
      expect(metric.responseYieldPercent).toBe(100);
    }
    for (const pid of ['0105', '0142']) {
      const metric = result.perPid.find(item => item.requestId === pid)!;
      expect(metric.attempts).toBe(0);
      expect(metric.responseYieldPercent).toBeNull();
    }
    expect(result.safeEvents.filter(e => e.values.length === 1)).toHaveLength(80);
    expect(result.safeEvents.filter(e => e.command === '010D').every(e => e.values[0].value === 0)).toBe(true);
  });

  it('accepts only correlated 0x41 Mode 01 ECU replies and flags mismatches instead of COMPLETE', () => {
    const good = event(1, '010C', 'SUCCESS', 1000, 100, 750);
    const wrongService = event(2, '010C', 'SUCCESS', 1300, 100, 770);
    wrongService.decodedReadings[0].service = '01'; // request service, not an ECU reply
    const wrongPid = event(3, '010C', 'SUCCESS', 1600, 100, 780);
    wrongPid.decodedReadings[0].pid = '0D';
    const wrongOrigin = event(4, '010C', 'SUCCESS', 1900, 100, 790);
    wrongOrigin.decodedReadings[0].origin = 'VIRTUAL';
    const result = calculateRoadTestMetrics([good,wrongService,wrongPid,wrongOrigin]);
    const rpm = result.perPid.find(item => item.requestId === '010C')!;
    expect(rpm.attempts).toBe(4);
    expect(rpm.validResponses).toBe(1);
    expect(rpm.validReadings).toBe(1);
    expect(result.trust).toBe('DEGRADED');
    expect(result.issues).toContain('UNMATCHED_SUCCESS_READINGS');
    expect(result.safeEvents.map(item => item.values.length)).toEqual([1,0,0,0]);
  });

  it('rejects duplicate sequences without double-counting an ECU success', () => {
    const data = calculateRoadTestMetrics([
      event(1, '010C'), event(1, '010C'), event(2, '010C'),
    ]);
    expect(data.trust).toBe('DEGRADED');
    expect(data.issues).toContain('DUPLICATE_EVENT_SEQUENCE');
    expect(data.totalEligibleAttempts).toBe(2);
  });

  it('sorts sequence deterministically and reports timestamp regressions without manufacturing negative intervals', () => {
    const data = calculateRoadTestMetrics([
      event(3, '010C', 'SUCCESS', 2000), event(1, '010C', 'SUCCESS', 3000),
      event(2, '010C', 'SUCCESS', 1000),
    ]);
    expect(data.issues).toContain('OUT_OF_ORDER_COMPLETION_TIMESTAMPS');
    expect(data.trust).toBe('DEGRADED');
    expect(data.perPid.find(x => x.requestId === '010C')!.validUpdateIntervalMs).toEqual({
      n: 2, p50: 1000, p95: 1000, max: 1000,
    });
  });

  it('quarantines invalid timestamps, NaN values and bad latency without inventing numerical evidence', () => {
    const bad = {
      ...event(1, '010C', 'SUCCESS', 1000, Number.NaN, Number.NaN),
      requestedAt: 2000,
    };
    const data = calculateRoadTestMetrics([bad, event(2, '010C', 'NO_DATA', 2200, 10, null)]);
    const rpm = data.perPid.find(x => x.requestId === '010C')!;
    expect(data.issues).toEqual(expect.arrayContaining(['INVALID_EVENT_TIMESTAMPS', 'INVALID_STORED_LATENCY', 'INVALID_GOOD_READING']));
    expect(rpm.attempts).toBe(2);
    expect(rpm.validResponses).toBe(0);
    expect(rpm.responseLatencyMs.n).toBe(1);
    expect(rpm.validUpdateIntervalMs.n).toBe(0);
    expect(data.trust).toBe('DEGRADED');
  });

  it('does not invent percentages or latencies for a PID with zero attempts', () => {
    const data = calculateRoadTestMetrics([]);
    expect(data.trust).toBe('UNAVAILABLE');
    const coolant = data.perPid.find(x => x.requestId === '0105')!;
    expect(coolant.responseYieldPercent).toBeNull();
    expect(coolant.responseLatencyMs).toEqual({ n: 0, p50: null, p95: null, max: null });
  });

  it('marks upstream block corruption as degraded even with valid surviving data', () => {
    const data = calculateRoadTestMetrics([event(1, '010C')], ['BLOCK_CRC_MISMATCH']);
    expect(data.trust).toBe('DEGRADED');
    expect(data.issues).toContain('BLOCK_CRC_MISMATCH');
    expect(data.totalEligibleAttempts).toBe(1);
  });

  it('flags sequence gaps and excludes false ECU labels or quality INVALID', () => {
    const source = event(3, '010C');
    const fake = {
      ...source,
      decodedReadings: [{ ...source.decodedReadings[0], quality: 'INVALID' as const }],
    };
    const data = calculateRoadTestMetrics([event(1, '010C'), fake]);
    expect(data.issues).toContain('EVENT_SEQUENCE_GAP');
    expect(data.perPid.find(x=>x.requestId==='010C')!.validResponses).toBe(1);
  });
});
