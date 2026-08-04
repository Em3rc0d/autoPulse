import { PayloadAdapter, Obd2TelemetryFrame, EncodeResult, DecodeResult, Obd2AcquisitionEvent, Obd2DecodedReading } from './PayloadAdapter';

export class CompactArrayJsonAdapter implements PayloadAdapter {
  readonly formatId = 'COMPACT_ARRAY_JSON_OBD2_V2';
  readonly formatVersion = '2.0';
  readonly storageType = 'TEXT';

  encode(frames: Obd2TelemetryFrame[]): EncodeResult {
    let eventCount = 0;
    let readingCount = 0;

    // Frame array format:
    // [timestampMs, sequenceNumber, protocolCode, eventsArray]

    // Event array format:
    // [requestSequence, ecuAddress, service, pid, requestDelta, responseDelta, decodeDelta, outcome, errorCode, connectionState, readingsArray]

    // Reading array format:
    // [signalDefinitionId, normalizedValue, unit, quality, rawNumericValue]

    const compactFrames = frames.map(f => {
      eventCount += f.events.length;
      return [
        f.timestampMs,
        f.sequenceNumber,
        f.protocolCode,
        f.events.map(e => {
          readingCount += e.readings.length;
          return [
            e.requestSequence,
            e.ecuAddress ?? null,
            e.service ?? null,
            e.pid ?? null,
            e.requestDelta,
            e.responseDelta ?? null,
            e.decodeDelta ?? null,
            e.outcome,
            e.errorCode ?? null,
            e.connectionState,
            e.readings.map(r => [
              r.signalDefinitionId,
              r.normalizedValue,
              r.unit,
              r.quality,
              r.rawNumericValue ?? null
            ])
          ];
        })
      ];
    });

    const envelope = {
      v: this.formatVersion,
      f: compactFrames
    };

    const payload = JSON.stringify(envelope);
    const byteSize = payload.length;

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

    if (parsed.v !== this.formatVersion) {
      errors.push('Unsupported version: ' + parsed.v);
    }

    if (!Array.isArray(parsed.f)) {
      errors.push('Missing or invalid frames array');
      return { frames: [], eventCount: 0, readingCount: 0, formatVersion: parsed.v || 'unknown', errors };
    }

    let eventCount = 0;
    let readingCount = 0;
    const frames: Obd2TelemetryFrame[] = [];

    for (const f of parsed.f) {
      if (!Array.isArray(f) || f.length < 4) {
        errors.push('Malformed frame array');
        continue;
      }

      const events: Obd2AcquisitionEvent[] = [];
      const evArr = f[3];
      if (Array.isArray(evArr)) {
        eventCount += evArr.length;
        for (const e of evArr) {
          if (!Array.isArray(e) || e.length < 11) {
            errors.push('Malformed event array');
            continue;
          }

          const rdArr = e[10];
          const readings: Obd2DecodedReading[] = [];
          if (Array.isArray(rdArr)) {
            readingCount += rdArr.length;
            for (const r of rdArr) {
              if (!Array.isArray(r) || r.length < 4) {
                errors.push('Malformed reading array');
                continue;
              }
              readings.push({
                signalDefinitionId: r[0],
                normalizedValue: r[1],
                unit: r[2],
                quality: r[3],
                rawNumericValue: r[4] === null ? undefined : r[4]
              });
            }
          }

          events.push({
            requestSequence: e[0],
            ecuAddress: e[1] === null ? undefined : e[1],
            service: e[2] === null ? undefined : e[2],
            pid: e[3] === null ? undefined : e[3],
            requestDelta: e[4],
            responseDelta: e[5] === null ? undefined : e[5],
            decodeDelta: e[6] === null ? undefined : e[6],
            outcome: e[7],
            errorCode: e[8] === null ? undefined : e[8],
            connectionState: e[9],
            readings
          });
        }
      }

      frames.push({
        timestampMs: f[0],
        sequenceNumber: f[1],
        protocolCode: f[2],
        events
      });
    }

    return {
      frames,
      eventCount,
      readingCount,
      formatVersion: parsed.v || 'unknown',
      errors
    };
  }
}
