import { bootstrapProductDb } from '../product/bootstrap';
import { ProductIdGenerator } from '../product/uuidv7';

describe('bootstrapProductDb', () => {
  let mockDb: any;
  let mockTx: any;
  
  let identityResultMock: any[];
  let contextResultMock: any[];

  beforeEach(() => {
    identityResultMock = [];
    contextResultMock = [];

    mockTx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation((table: any) => {
          if (table?.databaseKind) { // roughly identifies schema.databaseIdentity if needed, but actually we can just use the table name if it has one. Let's return a fake query builder
            return {
              limit: jest.fn().mockResolvedValue(identityResultMock),
              then: (resolve: any) => resolve(identityResultMock) // Just in case
            };
          }
          return {
            limit: jest.fn().mockResolvedValue(contextResultMock),
            then: (resolve: any) => resolve(contextResultMock) // For local_app_context
          };
        })
      }),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoNothing: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      query: {
        workspaces: { findFirst: jest.fn() },
        operators: { findFirst: jest.fn() }
      }
    };

    mockDb = {
      transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTx))
    };
  });

  it('rejects if identity is not PRODUCT', async () => {
    identityResultMock = [{ databaseKind: 'BENCHMARK' }];
    await expect(bootstrapProductDb(mockDb)).rejects.toThrow('LOCAL_CONTEXT_CORRUPT: Cannot bootstrap a non-product database.');
  });

  it('creates initial context and syncs installationId on empty database', async () => {
    identityResultMock = [{ databaseKind: 'PRODUCT' }];
    contextResultMock = [];

    const generatedContext = {
      singletonKey: 1,
      installationId: 'inst-1',
      defaultWorkspaceId: 'ws-1',
      defaultOperatorId: 'op-1',
    };
    mockTx.returning.mockResolvedValueOnce([generatedContext]);

    const result = await bootstrapProductDb(mockDb);
    
    expect(result).toBe(generatedContext);
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalledTimes(5); 
  });

  describe('installationId reconciliation matrix', () => {
    beforeEach(() => {
      mockTx.query.workspaces.findFirst.mockResolvedValue({ id: 'ws-1' });
      mockTx.query.operators.findFirst.mockResolvedValue({ id: 'op-1' });
    });

    it('PENDING / UUID real -> context gana', async () => {
      identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'PENDING' }];
      contextResultMock = [{ installationId: 'real-uuid', defaultWorkspaceId: 'ws-1', defaultOperatorId: 'op-1' }];
      
      const result = await bootstrapProductDb(mockDb);
      expect(mockTx.update).toHaveBeenCalled();
      expect(result.installationId).toBe('real-uuid');
    });

    it('null / UUID real -> context gana', async () => {
      identityResultMock = [{ databaseKind: 'PRODUCT', installationId: null }];
      contextResultMock = [{ installationId: 'real-uuid', defaultWorkspaceId: 'ws-1', defaultOperatorId: 'op-1' }];
      
      const result = await bootstrapProductDb(mockDb);
      expect(mockTx.update).toHaveBeenCalled();
      expect(result.installationId).toBe('real-uuid');
    });

    it('UUID real / PENDING -> identity gana', async () => {
      identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'real-uuid' }];
      contextResultMock = [{ installationId: 'PENDING', defaultWorkspaceId: 'ws-1', defaultOperatorId: 'op-1' }];
      
      const result = await bootstrapProductDb(mockDb);
      expect(mockTx.update).toHaveBeenCalled();
      expect(result.installationId).toBe('real-uuid');
    });

    it('PENDING / PENDING -> genera uno nuevo para ambos', async () => {
      identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'PENDING' }];
      contextResultMock = [{ installationId: 'PENDING', defaultWorkspaceId: 'ws-1', defaultOperatorId: 'op-1' }];
      
      const result = await bootstrapProductDb(mockDb);
      expect(mockTx.update).toHaveBeenCalledTimes(2);
      expect(result.installationId).not.toBe('PENDING');
      expect(result.installationId).toBeTruthy();
    });

    it('UUID-A / UUID-A -> idempotente', async () => {
      identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'uuid-a' }];
      contextResultMock = [{ installationId: 'uuid-a', defaultWorkspaceId: 'ws-1', defaultOperatorId: 'op-1' }];
      
      const result = await bootstrapProductDb(mockDb);
      expect(mockTx.update).not.toHaveBeenCalled();
      expect(result.installationId).toBe('uuid-a');
    });

    it('UUID-A / UUID-B -> lanza LOCAL_CONTEXT_CORRUPT', async () => {
      identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'uuid-a' }];
      contextResultMock = [{ installationId: 'uuid-b', defaultWorkspaceId: 'ws-1', defaultOperatorId: 'op-1' }];
      
      await expect(bootstrapProductDb(mockDb)).rejects.toThrow('LOCAL_CONTEXT_CORRUPT');
    });
  });
});
