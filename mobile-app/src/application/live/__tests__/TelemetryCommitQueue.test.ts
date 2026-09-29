import {
  TelemetryCommitQueue,
  CommitQueueEvent,
  MAX_PENDING_TELEMETRY_BLOCKS,
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
    windowIndex: seq,
    startedAt: seq * 5000,
    endedAt: (seq + 1) * 5000,
    isPartial: false,
    formatId: 'BINARY_OBD2_V3',
    formatVersion: 3,
    eventCount: 1,
    readingCount: 1,
    firstEventSequence: seq,
    lastEventSequence: seq,
    decoderVersion: '3.0.0',
    codecImplementationVersion: '3.0.0',
    storageType: 'BLOB',
    payloadCrc: 123,
    crcAlgorithm: 'CRC32',
    payloadByteLength: 3,
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

  it('fails closed before a hung repository can grow memory without bound', async () => {
    mockRepo.commitBlock.mockImplementation(() => new Promise(() => undefined));

    for (let seq = 0; seq < MAX_PENDING_TELEMETRY_BLOCKS; seq += 1) {
      queue.enqueue(makeBlock(seq));
    }
    expect(queue.getPendingCount()).toBe(MAX_PENDING_TELEMETRY_BLOCKS);
    expect(queue.getHasFailed()).toBe(false);

    const overflowBlock = makeBlock(MAX_PENDING_TELEMETRY_BLOCKS);
    queue.enqueue(overflowBlock);

    expect(queue.getPendingCount()).toBe(MAX_PENDING_TELEMETRY_BLOCKS);
    expect(queue.getHasFailed()).toBe(true);
    expect(events).toContainEqual({
      type: 'FAILED',
      errorReason: 'TELEMETRY_BACKPRESSURE_OVERFLOW',
      block: overflowBlock,
    });

    queue.enqueue(makeBlock(MAX_PENDING_TELEMETRY_BLOCKS + 1));
    expect(queue.getPendingCount()).toBe(MAX_PENDING_TELEMETRY_BLOCKS);
  });
});
