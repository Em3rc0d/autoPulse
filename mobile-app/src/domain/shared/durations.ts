import { Brand } from './identifiers';

export type DurationMs = Brand<number, 'DurationMs'>;
export type ElapsedMs = Brand<number, 'ElapsedMs'>;
export type SequenceNumber = Brand<number, 'SequenceNumber'>;

export function createDurationMs(ms: number): DurationMs {
  if (ms < 0) throw new Error('Duration cannot be negative');
  return ms as DurationMs;
}

export function createElapsedMs(ms: number): ElapsedMs {
  if (ms < 0) throw new Error('Elapsed time cannot be negative');
  return ms as ElapsedMs;
}

export function createSequenceNumber(seq: number): SequenceNumber {
  if (seq < 0 || !Number.isInteger(seq)) {
    throw new Error('Sequence must be a non-negative integer');
  }
  return seq as SequenceNumber;
}
