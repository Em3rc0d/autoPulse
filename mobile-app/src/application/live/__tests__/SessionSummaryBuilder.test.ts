import { SessionSummaryBuilder, SessionSummaryBuildAbortedError } from '../SessionSummaryBuilder';
import { SessionIntegrityState, SessionAcquisitionMode } from '../../../domain/telemetry/models/sessionSummaryResult';

describe('SessionSummaryBuilder', () => {
  let builder: SessionSummaryBuilder;
  let mockLiveSessionRepository: any;
  let mockTelemetryBlockRepository: any;
  let mockCodec: any;

  beforeEach(() => {
    mockLiveSessionRepository = {
      getSessionById: jest.fn()
    };
    mockTelemetryBlockRepository = {
      getAllBlocksForSession: jest.fn()
    };
    mockCodec = {
      decode: jest.fn()
    };

    builder = new SessionSummaryBuilder(
      mockLiveSessionRepository,
      mockTelemetryBlockRepository,
      mockCodec
    );
  });

  it('throws an error if session is not found', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue(null);

    await expect(builder.build('ws-1', 'session-1')).rejects.toThrow('SESSION_NOT_FOUND');
  });

  it('builds summary for an empty session', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({
      id: 'session-1',
      workspaceId: 'ws-1',
      vehicleId: 'veh-1',
      adapterInstanceId: 'VIRTUAL',
      status: 'COMPLETED',
      startedAt: 1000,
      endedAt: 2000,
      totalBlocks: 0
    });
    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([]);

    const result = await builder.build('ws-1', 'session-1');

    expect(result.sessionId).toBe('session-1');
    expect(result.acquisitionMode).toBe(SessionAcquisitionMode.LAPTOP_REPLAY);
    expect(result.durationSeconds).toBe(1);
    expect(result.integrityState).toBe(SessionIntegrityState.UNAVAILABLE);
    expect(result.expectedBlocksCount).toBe(0);
    expect(result.foundBlocksCount).toBe(0);
    expect(result.totalEventsCount).toBe(0);
    expect(result.totalReadingsCount).toBe(0);
  });

  it('aggregates metrics correctly for one block with readings', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({
      id: 's-1',
      workspaceId: 'ws-1',
      vehicleId: 'v-1',
      adapterInstanceId: 'BLE-1',
      status: 'COMPLETED',
      startedAt: 1000,
      endedAt: 3000,
      totalBlocks: 1
    });

    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      {
        status: 'VALID',
        block: { windowIndex: 0, firstEventSequence: 0, lastEventSequence: 1, isPartial: false }
      }
    ]);

    mockCodec.decode.mockReturnValue({
      events: [
        {
          decodedReadings: [
            { signalId: '010C', value: 1000, quality: 'GOOD', observedAt: 1100 },
            { signalId: '010D', value: 50, quality: 'GOOD', observedAt: 1100 }
          ]
        },
        {
          decodedReadings: [
            { signalId: '010C', value: 2000, quality: 'VALID', observedAt: 1200 },
            { signalId: '010D', value: 0, quality: 'VALID', observedAt: 1200 } // Speed = 0 is valid
          ]
        }
      ]
    });

    const result = await builder.build('ws-1', 's-1');

    expect(result.integrityState).toBe(SessionIntegrityState.COMPLETE);
    expect(result.totalEventsCount).toBe(2);
    expect(result.totalReadingsCount).toBe(4);

    const rpm = result.signalSummaries['010C'];
    expect(rpm.validReadingsCount).toBe(2);
    expect(rpm.min).toBe(1000);
    expect(rpm.max).toBe(2000);
    expect(rpm.avg).toBe(1500);

    const speed = result.signalSummaries['010D'];
    expect(speed.validReadingsCount).toBe(2);
    expect(speed.min).toBe(0);
    expect(speed.max).toBe(50);
    expect(speed.avg).toBe(25);
  });

  it('marks integrity as DEGRADED when gaps are detected or blocks are corrupted', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({
      id: 's-1',
      workspaceId: 'ws-1',
      vehicleId: 'v-1',
      status: 'COMPLETED'
    });

    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0 } },
      { status: 'CORRUPTED', error: new Error('CRC mismatch') },
      { status: 'VALID', block: { windowIndex: 2 } }
    ]);

    mockCodec.decode.mockReturnValue({ events: [] });

    const result = await builder.build('ws-1', 's-1');

    expect(result.integrityState).toBe(SessionIntegrityState.DEGRADED);
    expect(result.corruptedBlocksCount).toBe(1);
    expect(result.foundBlocksCount).toBe(3);
  });

  it('marks integrity as PARTIAL when session is INTERRUPTED', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({
      id: 's-1',
      workspaceId: 'ws-1',
      vehicleId: 'v-1',
      status: 'INTERRUPTED'
    });

    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0, isPartial: true } }
    ]);

    mockCodec.decode.mockReturnValue({ events: [] });

    const result = await builder.build('ws-1', 's-1');

    expect(result.integrityState).toBe(SessionIntegrityState.PARTIAL);
  });

  it('aborts the build process when abortSignal is triggered', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({ id: 's-1', workspaceId: 'ws-1' });
    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0 } },
      { status: 'VALID', block: { windowIndex: 1 } }
    ]);
    mockCodec.decode.mockReturnValue({ events: [] });

    const ac = new AbortController();
    ac.abort();

    await expect(builder.build('ws-1', 's-1', undefined, ac.signal)).rejects.toThrow(SessionSummaryBuildAbortedError);
  });

  it('throws unexpected errors instead of counting them as corrupted blocks', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({ id: 's-1', workspaceId: 'ws-1' });
    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0 } }
    ]);
    mockCodec.decode.mockImplementation(() => {
      throw new Error('Some unexpected error like out of memory');
    });

    await expect(builder.build('ws-1', 's-1')).rejects.toThrow('Some unexpected error like out of memory');
  });

  it('detects sequence gaps as degraded integrity', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({ id: 's-1', workspaceId: 'ws-1', status: 'COMPLETED' });
    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0, firstEventSequence: 1, lastEventSequence: 5 } },
      { status: 'VALID', block: { windowIndex: 1, firstEventSequence: 7, lastEventSequence: 10 } }
    ]);
    mockCodec.decode.mockReturnValue({ events: [] });

    const result = await builder.build('ws-1', 's-1');
    expect(result.integrityState).toBe(SessionIntegrityState.DEGRADED);
    expect(result.gapsDetectedCount).toBeGreaterThan(0);
  });

  it('detects sequence overlaps or regressions as degraded integrity', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({ id: 's-1', workspaceId: 'ws-1', status: 'COMPLETED' });
    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0, firstEventSequence: 1, lastEventSequence: 5 } },
      { status: 'VALID', block: { windowIndex: 1, firstEventSequence: 4, lastEventSequence: 10 } }
    ]);
    mockCodec.decode.mockReturnValue({ events: [] });

    const result = await builder.build('ws-1', 's-1');
    expect(result.integrityState).toBe(SessionIntegrityState.DEGRADED);
    expect(result.gapsDetectedCount).toBeGreaterThan(0);
  });

  it('separates unsupported versions from corrupted payloads', async () => {
    mockLiveSessionRepository.getSessionById.mockResolvedValue({ id: 's-1', workspaceId: 'ws-1', status: 'COMPLETED' });
    mockTelemetryBlockRepository.getAllBlocksForSession.mockResolvedValue([
      { status: 'VALID', block: { windowIndex: 0 } }, // Will throw unsupported
      { status: 'VALID', block: { windowIndex: 1 } }, // Will throw corrupted
      { status: 'VALID', block: { windowIndex: 2 } }  // Valid
    ]);

    mockCodec.decode.mockImplementationOnce(() => {
      throw new Error('UNSUPPORTED_CODEC_VERSION: Version 9.0 not supported');
    }).mockImplementationOnce(() => {
      throw new Error('CORRUPTED_PAYLOAD: CRC mismatch');
    }).mockReturnValueOnce({ events: [] });

    const result = await builder.build('ws-1', 's-1');
    expect(result.corruptedBlocksCount).toBe(1);
    expect(result.unsupportedBlocksCount).toBe(1);
    expect(result.integrityState).toBe(SessionIntegrityState.DEGRADED);
  });
});
