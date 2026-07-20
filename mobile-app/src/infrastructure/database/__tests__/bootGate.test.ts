import { initializeSpikeDatabase } from '../migrator';
import { getDatabaseConnection } from '../connection';

jest.mock('../connection', () => ({
  DATABASE_NAME: 'autopulse_spike.db',
  getDatabaseConnection: jest.fn()
}));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  migrate: jest.fn()
}));
// This mock is needed because babel-plugin-inline-import might not work nicely with jest directly without setup
jest.mock('../migrations/migrations', () => ({}), { virtual: true });

describe('Database Boot Gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return HEALTHY state when migration succeeds', async () => {
    const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const mockGetAllAsync = jest.fn().mockResolvedValue([{ id: 1, notes: null }]);
    
    (getDatabaseConnection as jest.Mock).mockReturnValue({
      expoDb: { runAsync: mockRunAsync, getAllAsync: mockGetAllAsync },
      db: {}
    });

    const result = await initializeSpikeDatabase();
    expect(result.state).toBe('HEALTHY');
    expect(result.isReadable).toBe(true);
    expect(result.isWritable).toBe(true);
  });

  it('should return FAILED state when migration throws an error', async () => {
    const { migrate } = require('drizzle-orm/expo-sqlite/migrator');
    migrate.mockRejectedValueOnce(new Error('Migration failed completely'));
    
    (getDatabaseConnection as jest.Mock).mockReturnValue({
      expoDb: {},
      db: {}
    });

    const result = await initializeSpikeDatabase();
    expect(result.state).toBe('FAILED');
    expect(result.isSafeToContinueLegacy).toBe(true); // Must not block legacy
  });

  it('should return SCHEMA_MISMATCH state when table does not exist after migration', async () => {
    const mockGetAllAsync = jest.fn().mockRejectedValue(new Error('no such table: technical_health_checks'));
    const mockRunAsync = jest.fn().mockRejectedValue(new Error('no such table: technical_health_checks'));
    
    (getDatabaseConnection as jest.Mock).mockReturnValue({
      expoDb: { getAllAsync: mockGetAllAsync, runAsync: mockRunAsync },
      db: {}
    });

    const result = await initializeSpikeDatabase();
    expect(result.state).toBe('SCHEMA_MISMATCH');
    expect(result.isSafeToContinueLegacy).toBe(true);
  });
});
