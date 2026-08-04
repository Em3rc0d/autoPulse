import { EncodedTelemetryBlock } from '../models/EncodedTelemetryBlock';

export type CommitOutcome =
  | { success: true; disposition: 'COMMITTED' }
  | { success: true; disposition: 'ALREADY_COMMITTED' }
  | {
      success: false;
      reason:
        | 'SESSION_NOT_FOUND'
        | 'WORKSPACE_MISMATCH'
        | 'SESSION_NOT_RECORDABLE'
        | 'BLOCK_SEQUENCE_CONFLICT'
        | 'BLOCK_SEQUENCE_GAP'
        | 'REGRESSIVE_BLOCK_SEQUENCE'
        | 'INVALID_BLOCK_METADATA'
        | 'INVALID_BLOCK_CRC'
        | 'UNSUPPORTED_FORMAT'
        | 'DATABASE_WRITE_FAILED'
        | 'CONCURRENT_SESSION_UPDATE';
    };

export type BlockReadResult =
  | { status: 'VALID'; block: EncodedTelemetryBlock }
  | { status: 'CORRUPTED' | 'TRUNCATED' | 'UNSUPPORTED_FORMAT' | 'DECODE_FAILED'; error: Error }
  | { status: 'NOT_FOUND' };

export interface ITelemetryBlockRepository {
  commitBlock(
    workspaceId: string,
    sessionId: string,
    encodedBlock: EncodedTelemetryBlock
  ): Promise<CommitOutcome>;

  getBlock(sessionId: string, blockSequence: number): Promise<BlockReadResult>;

  getLastCommittedBlock(sessionId: string): Promise<BlockReadResult | null>;

  verifyStoredBlock(sessionId: string, blockSequence: number): Promise<boolean>;

  getAllBlocksForSession(sessionId: string): Promise<BlockReadResult[]>;
}
