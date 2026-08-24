jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn().mockReturnValue(new Uint8Array(16))
}));

import { LiveSessionRepository } from '../live-session.repository';

describe('LiveSessionRepository - Orphan Recovery', () => {
  let mockDb: any;
  let repo: LiveSessionRepository;

  beforeEach(() => {
    let whereCallCount = 0;
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) {
          return Promise.resolve([{
            id: 'sess-1',
            workspaceId: 'ws1',
            status: 'ACTIVE',
            startedAt: 1000,
            createdAt: 900,
            endedAt: null,
            stopReason: null,
            failureCode: null
          }]);
        }
        if (whereCallCount === 2) {
          return Promise.resolve([{
            blocks: 5,
            events: 10,
            readings: 20,
            maxSeq: 4,
            maxBlockEnd: 7000
          }]);
        }
        // nextEventSequence()
        return Promise.resolve([{ max: 3 }]);
      }),
      all: jest.fn().mockResolvedValue([]),
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockDb)),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      run: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue(null)
    };
    repo = new LiveSessionRepository(mockDb);
  });

  it('reconciles durable counters, sequence and end time before marking ACTIVE as INTERRUPTED', async () => {
    await repo.recoverOrphanedSessions('ws1');

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);

    const updatePayload = mockDb.set.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
      status: 'INTERRUPTED',
      failureCode: 'UNEXPECTED_APP_TERMINATION',
      endedAt: 7000,
      totalBlocks: 5,
      totalEvents: 10,
      totalReadings: 20,
      lastCommittedSequence: 4
    });
    expect(updatePayload).not.toHaveProperty('lastSequenceNumber');
  });
});
