import { PayloadAdapter, Obd2TelemetryFrame, EncodeResult, DecodeResult } from './PayloadAdapter';

export class StandardJsonAdapter implements PayloadAdapter {
  readonly formatId = 'STANDARD_JSON_OBD2_V2';
  readonly formatVersion = '2.0';
  readonly storageType = 'TEXT';

  encode(frames: Obd2TelemetryFrame[]): EncodeResult {
    let eventCount = 0;
    let readingCount = 0;
    for (const f of frames) {
      eventCount += f.events.length;
      for (const e of f.events) {
        readingCount += e.readings.length;
      }
    }

    const envelope = {
      version: this.formatVersion,
      frames: frames
    };

    const payload = JSON.stringify(envelope);
    const byteSize = payload.length; // UTF-8 ascii approx

    return {
      payload,
      byteSize,
      frameCount: frames.length,
      eventCount,
      readingCount,
      formatVersion: this.formatVersion,
      payloadBytes: byteSize,
      dictionaryBytes: 0
    };
  }

  decode(payload: string | Uint8Array): DecodeResult {
    const errors: string[] = [];
    let parsed: any;

    if (typeof payload !== 'string') {
      errors.push('Expected string payload');
      return { frames: [], eventCount: 0, readingCount: 0, formatVersion: 'unknown', errors };
    }

    try {
      parsed = JSON.parse(payload);
    } catch (e: any) {
      errors.push('JSON parse error: ' + e.message);
      return { frames: [], eventCount: 0, readingCount: 0, formatVersion: 'unknown', errors };
    }

    if (parsed.version !== this.formatVersion) {
      errors.push('Unsupported version: ' + parsed.version);
    }

    if (!Array.isArray(parsed.frames)) {
      errors.push('Missing or invalid frames array');
      return { frames: [], eventCount: 0, readingCount: 0, formatVersion: parsed.version || 'unknown', errors };
    }

    let eventCount = 0;
    let readingCount = 0;
    for (const f of parsed.frames) {
      if (f.events && Array.isArray(f.events)) {
        eventCount += f.events.length;
        for (const e of f.events) {
          if (e.readings && Array.isArray(e.readings)) {
            readingCount += e.readings.length;
          }
        }
      }
    }

    return {
      frames: parsed.frames as Obd2TelemetryFrame[],
      eventCount,
      readingCount,
      formatVersion: parsed.version || 'unknown',
      errors
    };
  }
}
