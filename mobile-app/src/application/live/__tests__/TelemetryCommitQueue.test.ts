import {
  TelemetryCommitQueue,
  CommitQueueEvent,
  TelemetryCommitQueueDrainTimeoutError
} from '../TelemetryCommitQueue';
import { ITelemetryBlockRepository } from '../../../domain/telemetry/repositories/TelemetryBlockRepository';
import { EncodedTelemetryBlock } from '../../../domain/telemetry/models/EncodedTelemetryBlock';

describe('TelemetryCommitQueue', () => {
  let mockRepo: jest.Mocked<ITelemetryBlockRepository>;
  let events: CommitQueueEvent[];
  let onEvent: (event: CommitQueueEvent) => void;
  let queue: TelemetryCommitQueue;

  beforeEach(() => {
    mockRepo = {
      commitBlock: jest.fn()
    } as any;
    events = [];
    onEvent = (e) => events.push(e);
    queue = new TelemetryCommitQueue('ws1', 'sess1', mockRepo, onEvent);
  });

  const makeBlock = (seq: number): EncodedTelemetryBlock => ({
    sessionId: 'sess1',
    blockSequence: seq,
    windowIndex: 0,
    startedAt: 0,
    endedAt: 0,
    isPartial: false,
    formatId: 'BINARY_OBD2_V3',
    formatVersion: 3,
    eventCount: 1,
    readingCount: 1,
    firstEventSequence: 1,
    lastEventSequence: 1,
    decoderVersion: '3.0.0',
    codecImplementationVersion: '3.0.0',
    storageType: 'BLOB',
    payloadCrc: 123,
    crcAlgorithm: 'CRC32',
    payloadByteLength: 100,
    payload: new Uint8Array([1, 2, 3])
  });

  it('Blocks enter queue in order and drain successfully', async () => {
    mockRepo.commitBlock.mockResolvedValue({ success: true, disposition: 'COMMITTED' });

    queue.enqueue(makeBlock(1));
    queue.enqueue(makeBlock(2));

    await queue.drain();

    expect(mockRepo.commitBlock).toHaveBeenCalledTimes(2);
    expect(events.length).toBe(2);
    expect(events[0].type).toBe('COMMITTED');
    expect(events[1].type).toBe('COMMITTED');
  });

  it('Retry uses identical payload on transient failure', async () => {
    mockRepo.commitBlock
      .mockResolvedValueOnce({ success: false, reason: 'DATABASE_WRITE_FAILED' })
      .mockResolvedValueOnce({ success: true, disposition: 'COMMITTED' });

    queue.enqueue(makeBlock(1));
    await queue.drain();

    expect(mockRepo.commitBlock).toHaveBeenCalledTimes(2);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('COMMITTED');
  });

  it('Non-transient failure is not retried', async () => {
    mockRepo.commitBlock
      .mockResolvedValueOnce({ success: false, reason: 'BLOCK_SEQUENCE_GAP' });

    queue.enqueue(makeBlock(1));
    await queue.drain();

    expect(mockRepo.commitBlock).toHaveBeenCalledTimes(1);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('FAILED');
    expect(queue.getHasFailed()).toBe(true);
  });

  it('Queue fails and rejects subsequent blocks if one block fails finally', async () => {
    mockRepo.commitBlock
      .mockResolvedValueOnce({ success: false, reason: 'DATABASE_WRITE_FAILED' })
      .mockResolvedValueOnce({ success: false, reason: 'DATABASE_WRITE_FAILED' });

    queue.enqueue(makeBlock(1));
    await queue.drain();

    expect(events[0].type).toBe('FAILED');
    expect(queue.getHasFailed()).toBe(true);

    queue.enqueue(makeBlock(2));
    expect(queue.getPendingCount()).toBe(1); // Block 1 is retained after failure; block 2 is rejected.
  });

  it('drain is bounded when a repository commit never resolves', async () => {
    mockRepo.commitBlock.mockImplementation(() => new Promise(() => undefined));

    queue.enqueue(makeBlock(1));

    await expect(queue.drain(20, 2)).rejects.toBeInstanceOf(TelemetryCommitQueueDrainTimeoutError);
    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getHasFailed()).toBe(false);
  });
});
