import { BinaryObd2V3Codec } from '../../../infrastructure/telemetry-codecs/binary-obd2-v3/BinaryObd2V3Codec';
import type { UnencodedTelemetryBlock } from '../../../domain/telemetry/models/UnencodedTelemetryBlock';
import type { ObdAcquisitionEvent } from '../../../domain/telemetry/models/ObdAcquisitionEvent';
import { RoadTestObservabilityService } from '../RoadTestObservabilityService';

const codec = new BinaryObd2V3Codec();
function specimen(): UnencodedTelemetryBlock {
  const event: ObdAcquisitionEvent = {
    sessionId: 's1', sequenceNumber: 1, requestId: 'PRIVATE_REQ',
    command: '010C', commandFamily: 'OBD_MODE_01',
    requestedAt: 1200, completedAt: 1300, latencyMs: 100,
    status: 'SUCCESS', completionReason: 'PROMPT_RECEIVED',
    rawText: 'PRIVATE_VIN_RAW',
    rawFragments: [{ receivedAt: 1250, decodedText: 'PRIVATE_VIN_RAW' }],
    frames: [], negativeResponses: [], warnings: [],
    decodedReadings: [{
      signalId: 'RPM', service: '01', pid: '0C', value: 800, unit: 'RPM',
      rawBytes: [1], origin: 'OBD2', quality: 'GOOD', sourceEcu: '7E8', observedAt: 1300,
    }],
  };
  return {
    sessionId: 's1', blockSequence: 0, windowIndex: 0,
    startedAt: 1000, endedAt: 2000, isPartial: true,
    eventCount: 1, readingCount: 1,
    firstEventSequence: 1, lastEventSequence: 1,
    events: [event],
  };
}
function harness(options: { status?: string; blocks?: any[]; totalEvents?: number; adapter?: string } = {}) {
  const encoded = codec.encode(specimen());
  const sessions = {
    getSessionById: jest.fn(async () => ({
      id: 's1', status: options.status ?? 'COMPLETED',
      adapterInstanceId: options.adapter ?? 'BLE1',
      totalBlocks: 1, totalEvents: options.totalEvents ?? 1, totalReadings: 1,
    })),
  };
  const blocks = {
    getAllBlocksForSession: jest.fn(async () => options.blocks ?? [{ status: 'VALID', block: encoded }]),
  };
  const service = new RoadTestObservabilityService(sessions as any, blocks as any, codec);
  return { service, sessions, blocks, encoded };
}
describe('ROAD TEST-001 post-session persisted V3 analysis', () => {
  it('calculates from REAL V3 encoded then decoded committed block, with no raw data leakage', async () => {
    const { service, sessions, blocks } = harness();
    const report = await service.analyze('ws1', 's1');
    expect(sessions.getSessionById).toHaveBeenCalledWith('ws1', 's1');
    expect(blocks.getAllBlocksForSession).toHaveBeenCalledWith('s1');
    expect(report.metrics.trust).toBe('COMPLETE');
    expect(report.integrity).toMatchObject({
      validDecodedBlocks: 1, decodedEvents: 1, decodedReadings: 1, storedEvents: 1,
    });
    const rpm = report.metrics.perPid.find(x => x.requestId === '010C')!;
    expect(rpm.validResponses).toBe(1);
    expect(rpm.responseLatencyMs).toEqual({ n: 1, p50: 100, p95: 100, max: 100 });
    expect(rpm.validUpdateIntervalMs.n).toBe(0);
    expect(report.metrics.safeEvents[0].values).toEqual([{signal:'RPM',value:800,unit:'RPM'}]);
    const json = JSON.stringify(report);
    expect(json).not.toContain('PRIVATE_VIN_RAW');
    expect(json).not.toContain('PRIVATE_REQ');
    expect(json).not.toContain('BLE1');
    expect(json).not.toContain('"sessionId"');
  });

  it('refuses active, virtual or missing-workspace session before reading any block', async () => {
    for (const settings of [{status:'ACTIVE'}, {adapter:'VIRTUAL'}]) {
      const {service,blocks} = harness(settings);
      await expect(service.analyze('ws1','s1')).rejects.toThrow(/FORBIDDEN/);
      expect(blocks.getAllBlocksForSession).not.toHaveBeenCalled();
    }
    const {service,blocks} = harness();
    await expect(service.analyze('','s1')).rejects.toThrow('ROAD_TEST_IDENTITY_REQUIRED');
    expect(blocks.getAllBlocksForSession).not.toHaveBeenCalled();
  });

  it('refuses unknown session/workspace without looking up unscoped telemetry blocks', async () => {
    const {service,sessions,blocks} = harness();
    sessions.getSessionById.mockResolvedValueOnce(null as any);
    await expect(service.analyze('other','s1')).rejects.toThrow('ROAD_TEST_SESSION_NOT_FOUND');
    expect(blocks.getAllBlocksForSession).not.toHaveBeenCalled();
  });

  it('keeps a trustworthy partial report when a block CRC is corrupted, not fabricated COMPLETE', async () => {
    const { service } = harness({blocks:[{ status:'CORRUPTED',error:new Error('CRC mismatch') }]});
    const result = await service.analyze('ws1', 's1');
    expect(result.metrics.trust).toBe('DEGRADED');
    expect(result.integrity.issues).toContain('BLOCK_CORRUPTED');
    expect(result.integrity.issues).toContain('SESSION_EVENT_COUNT_MISMATCH');
    expect(result.metrics.totalEligibleAttempts).toBe(0);
  });

  it('flags a duplicate block and prevents double-counted raw events', async () => {
    const s = harness();
    const blk = {status:'VALID',block:s.encoded};
    const second = harness({blocks:[blk,blk]});
    const result = await second.service.analyze('ws1','s1');
    expect(result.metrics.trust).toBe('DEGRADED');
    expect(result.integrity.issues).toEqual(expect.arrayContaining(['DUPLICATE_OR_REGRESSIVE_BLOCK','BLOCK_COUNT_MISMATCH']));
    expect(result.metrics.totalEligibleAttempts).toBe(1);
  });

  it('preserves session interruption as degraded even if all stored blocks decode', async () => {
    const result = await harness({status:'INTERRUPTED'}).service.analyze('ws1','s1');
    expect(result.metrics.trust).toBe('DEGRADED');
    expect(result.integrity.issues).toContain('SESSION_INTERRUPTED');
  });

  it('detects unsupported codec, mismatched durable count and broken metadata', async () => {
    const s=harness();
    const bad={...s.encoded,eventCount:99};
    const result=await harness({blocks:[{status:'VALID',block:bad}],totalEvents:99}).service.analyze('ws1','s1');
    expect(result.metrics.trust).toBe('DEGRADED');
    expect(result.integrity.issues).toContain('BLOCK_METADATA_MISMATCH');
  });
});
