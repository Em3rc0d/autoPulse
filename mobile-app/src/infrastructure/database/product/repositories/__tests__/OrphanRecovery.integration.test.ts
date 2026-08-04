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
          return Promise.resolve([{ id: 'sess-1' }]);
        }
        return Promise.resolve([{
          blocks: 5,
          events: 10,
          readings: 20,
          maxSeq: 5
        }]);
      }),
      all: jest.fn().mockResolvedValue([]),
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockDb);
      }),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      run: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue(null)
    };
    repo = new LiveSessionRepository(mockDb);
  });

  it('Recovery executes once per call and reconciles counters correctly', async () => {
    // Mock the query that finds orphaned sessions (handled by where mock)

    await repo.recoverOrphanedSessions('ws1');

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);

    // Assert the exact values that were passed to the update
    const setCalls = mockDb.set.mock.calls;
    expect(setCalls.length).toBe(1);
    const updatePayload = setCalls[0][0];

    expect(updatePayload).toMatchObject({
      status: 'INTERRUPTED',
      stopReason: 'UNEXPECTED_APP_TERMINATION',
      totalBlocks: 5,
      totalEvents: 10,
      totalReadings: 20,
      lastSequenceNumber: 5
    });
  });
});
