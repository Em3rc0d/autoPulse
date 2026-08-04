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
    expect(mockTx.insert).toHaveBeenCalledTimes(3); 
  });

  it('validates existing context and rejects if installationId mismatches', async () => {
    identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'inst-1' }];
    contextResultMock = [{ installationId: 'inst-2' }];

    await expect(bootstrapProductDb(mockDb)).rejects.toThrow('LOCAL_CONTEXT_CORRUPT: database_identity.installation_id does not match local_app_context.installation_id');
  });

  it('validates existing context and returns it if everything is correct', async () => {
    const existingContext = {
      installationId: 'inst-1',
      defaultWorkspaceId: 'ws-1',
      defaultOperatorId: 'op-1'
    };

    identityResultMock = [{ databaseKind: 'PRODUCT', installationId: 'inst-1' }];
    contextResultMock = [existingContext];
    
    mockTx.query.workspaces.findFirst.mockResolvedValueOnce({ id: 'ws-1' });
    mockTx.query.operators.findFirst.mockResolvedValueOnce({ id: 'op-1' });

    const result = await bootstrapProductDb(mockDb);
    expect(result).toBe(existingContext);
  });
});
