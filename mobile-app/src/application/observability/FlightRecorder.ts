export type FlightRecorderCategory =
  | 'SESSION'
  | 'FOREGROUND_SERVICE'
  | 'BLUETOOTH'
  | 'OBD_TRANSPORT'
  | 'PERSISTENCE'
  | 'APP_LIFECYCLE';

export type FlightRecorderDetailValue = string | number | boolean | null | undefined;
export type FlightRecorderDetails = Readonly<Record<string, FlightRecorderDetailValue>>;

export interface FlightRecorderEntry {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly timestampMs: number;
  readonly category: FlightRecorderCategory;
  readonly event: string;
  readonly sessionId?: string;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;
}

export interface FlightRecorderInput {
  readonly category: FlightRecorderCategory;
  readonly event: string;
  readonly sessionId?: string;
  readonly details?: FlightRecorderDetails;
  readonly timestampMs?: number;
}

export const MAX_FLIGHT_RECORDER_EVENTS = 256;

const SENSITIVE_KEY = /(vin|plate|license|latitude|longitude|location|gps|route|secret|token|password|raw|payload|responseText)/i;
const MAX_STRING_LENGTH = 160;

function sanitizeDetails(details: FlightRecorderDetails | undefined) {
  const sanitized: Record<string, string | number | boolean | null> = {};
  if (!details) return sanitized;

  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'string') {
      sanitized[key] = value.length > MAX_STRING_LENGTH
        ? value.slice(0, MAX_STRING_LENGTH) + '…'
        : value;
      continue;
    }
    if (typeof value === 'number') {
      sanitized[key] = Number.isFinite(value) ? value : null;
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

class FlightRecorderImpl {
  private entries: FlightRecorderEntry[] = [];
  private nextSequence = 1;

  record(input: FlightRecorderInput): FlightRecorderEntry {
    const entry: FlightRecorderEntry = Object.freeze({
      schemaVersion: 1 as const,
      sequence: this.nextSequence++,
      timestampMs: input.timestampMs ?? Date.now(),
      category: input.category,
      event: input.event,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      details: Object.freeze(sanitizeDetails(input.details)),
    });

    this.entries.push(entry);
    if (this.entries.length > MAX_FLIGHT_RECORDER_EVENTS) {
      this.entries.shift();
    }

    // Structured and intentionally free of raw ELM payloads/VIN/location.
    // Android logcat can correlate this with native lifecycle failures.
    console.log('[AUTOPULSE_TRACE] ' + JSON.stringify(entry));
    return entry;
  }

  snapshot(): readonly FlightRecorderEntry[] {
    return this.entries.map(entry => Object.freeze({
      ...entry,
      details: Object.freeze({ ...entry.details }),
    }));
  }

  clear(): void {
    this.entries = [];
    this.nextSequence = 1;
  }
}

export const flightRecorder = new FlightRecorderImpl();
