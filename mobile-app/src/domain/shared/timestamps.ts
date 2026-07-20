import { Brand } from './identifiers';

export type UtcIsoTimestamp = Brand<string, 'UtcIsoTimestamp'>;

export function parseUtcIsoTimestamp(value: string): UtcIsoTimestamp {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid UTC ISO Timestamp: ${value}`);
  }
  return d.toISOString() as UtcIsoTimestamp;
}

export function nowUtc(): UtcIsoTimestamp {
  return new Date().toISOString() as UtcIsoTimestamp;
}
