import { Obd2AcquisitionEvent, Obd2DecodedReading, Obd2Outcome, TelemetryQuality, Obd2ErrorCode, ConnectionState } from '../../../domain/telemetry';
import { TelemetryBlockCodec, EncodeResult, DecodeResult, IntegrityResult, CodecContext } from '../contracts/TelemetryBlockCodec';

const OUTCOME_MAP: Obd2Outcome[] = ['VALUE', 'TIMEOUT', 'UNSUPPORTED', 'INVALID_RESPONSE', 'CONNECTION_ERROR', 'CANCELLED'];
const QUALITY_MAP: TelemetryQuality[] = ['VALID', 'DEGRADED', 'STALE', 'UNAVAILABLE', 'INVALID'];
const ERROR_MAP: Obd2ErrorCode[] = ['TIMEOUT', 'MALFORMED_RESPONSE', 'CHECKSUM_FAILURE', 'ADAPTER_DISCONNECTED', 'UNSUPPORTED_PID', 'REQUEST_CANCELLED', 'UNKNOWN_ERROR'];

export class BinaryObd2V2Codec implements TelemetryBlockCodec {
  readonly codecId = 'BINARY_OBD2_V2';
  readonly formatId = 'BINARY';
  readonly formatVersion = '2.0';

  private crc32Table: Uint32Array;

  private encodeString(str: string): Uint8Array {
    const utf8: number[] = [];
    for (let i = 0; i < str.length; i++) {
      let charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      }
      else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      }
      else {
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        );
      }
    }
    return new Uint8Array(utf8);
  }

  private decodeString(bytes: Uint8Array): string {
    let result = "";
    let i = 0;
    while (i < bytes.length) {
      let c = bytes[i++];
      if (c > 127) {
        if (c > 191 && c < 224) {
          if (i >= bytes.length) throw new Error("UTF-8 decode: incomplete 2-byte sequence");
          c = (c & 31) << 6 | bytes[i++] & 63;
        } else if (c > 223 && c < 240) {
          if (i + 1 >= bytes.length) throw new Error("UTF-8 decode: incomplete 3-byte sequence");
          c = (c & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
        } else if (c > 239 && c < 248) {
          if (i + 2 >= bytes.length) throw new Error("UTF-8 decode: incomplete 4-byte sequence");
          c = (c & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
        }
      }
      if (c <= 0xffff) result += String.fromCharCode(c);
      else if (c <= 0x10ffff) {
        c -= 0x10000;
        result += String.fromCharCode(c >> 10 | 0xd800);
        result += String.fromCharCode(c & 0x3FF | 0xdc00);
      }
    }
    return result;
  }

  constructor() {
    this.crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      this.crc32Table[i] = c;
    }
  }

  private crc32(buffer: Uint8Array, offset: number, length: number): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < length; i++) {
      const byte = buffer[offset + i];
      crc = this.crc32Table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  validate(payload: string | Uint8Array): IntegrityResult {
    if (typeof payload === 'string') {
      return { valid: false, error: 'Expected Uint8Array' };
    }
    if (payload.byteLength < 40) {
      return { valid: false, error: 'Payload too small to contain header' };
    }
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    if (view.getUint32(0, true) !== 0x3244424F) {
      return { valid: false, error: 'Invalid magic bytes' };
    }
    const totalBytes = view.getUint32(32, true);
    if (totalBytes !== payload.byteLength) {
      return { valid: false, error: 'Payload length mismatch' };
    }
    const expectedCrc = view.getUint32(36, true);

    // Zero out CRC field for calculation
    const originalCrc = new Uint8Array(4);
    originalCrc.set(new Uint8Array(payload.buffer, payload.byteOffset + 36, 4));
    view.setUint32(36, 0, true);

    const actualCrc = this.crc32(payload as Uint8Array, 8, totalBytes - 8);

    // Restore CRC field
    new Uint8Array(payload.buffer, payload.byteOffset + 36, 4).set(originalCrc);
    return {
      valid: expectedCrc === actualCrc,
      expectedChecksum: expectedCrc.toString(16),
      actualChecksum: actualCrc.toString(16)
    };
  }

  encode(events: Obd2AcquisitionEvent[], context?: CodecContext): EncodeResult {
    let readingCount = 0;

    // Pass 1: Build Dictionaries
    const targets: { ecuAddress: number, service: number, pid: number }[] = [];
    const signals: { signalDefinitionId: string, targetIndex: number, unit: string }[] = [];

    const getTargetIndex = (ecu: number = 0, srv: number = 0, pid: number = 0) => {
      let idx = targets.findIndex(t => t.ecuAddress === ecu && t.service === srv && t.pid === pid);
      if (idx === -1) {
        idx = targets.length;
        targets.push({ ecuAddress: ecu, service: srv, pid: pid });
      }
      return idx;
    };

    const getSignalIndex = (sigId: string, targetIdx: number, unit: string) => {
      let idx = signals.findIndex(s => s.signalDefinitionId === sigId && s.targetIndex === targetIdx && s.unit === unit);
      if (idx === -1) {
        idx = signals.length;
        signals.push({ signalDefinitionId: sigId, targetIndex: targetIdx, unit: unit });
      }
      return idx;
    };

    let eventsByteSize = 0;

    for (const e of events) {
      readingCount += e.readings.length;

      let targetIdx = 0;
      if (e.ecuAddress !== undefined || e.service !== undefined || e.pid !== undefined) {
        targetIdx = getTargetIndex(e.ecuAddress ?? 0, e.service ?? 0, e.pid ?? 0);
      }

      for (const r of e.readings) {
        getSignalIndex(r.signalDefinitionId, targetIdx, r.unit);
      }

      let eSize = 2; // Header(1) + Flags(1)
      eSize += 1; // Target Index
      eSize += 4; // Request Sequence
      eSize += 2; // Request Delta

      if (e.outcome === 'VALUE') {
        eSize += 4; // Response + Decode deltas
        eSize += 1; // Readings count
        eSize += e.readings.length * 6; // Index(1) + Quality(1) + Float32(4)
      } else if (e.outcome === 'TIMEOUT' || e.outcome === 'UNSUPPORTED') {
        eSize += 1; // ErrorCode
      } else if (e.outcome === 'INVALID_RESPONSE') {
        eSize += 2; // Response Delta
        eSize += 1; // Error Code
      } else if (e.outcome === 'CONNECTION_ERROR' || e.outcome === 'CANCELLED') {
        eSize += 1; // Error Code
      }

      eventsByteSize += eSize;
    }

    // Pass 2: Calculate Dictionary Size
    let targetDictBytes = targets.length * 7;
    let signalDictBytes = 0;

    const signalStrings: Uint8Array[] = [];
    for (const s of signals) {
      const sigBuf = this.encodeString(s.signalDefinitionId);
      const unitBuf = this.encodeString(s.unit);
      signalDictBytes += 4 + sigBuf.length + 1 + unitBuf.length;
      signalStrings.push(sigBuf);
      signalStrings.push(unitBuf);
    }

    const dictBytes = 2 + targetDictBytes + 2 + signalDictBytes;
    const totalBytes = 40 + dictBytes + eventsByteSize;
    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // 1. ENVELOPE (40 Bytes)
    view.setUint32(0, 0x3244424F, true); // Magic 'OBD2' LE
    view.setUint16(4, 2, true); // Version
    view.setUint8(6, 0); // Flags
    view.setUint8(7, 40); // Header length

    // Default dummy for block start
    view.setUint32(8, 0, true);
    view.setUint32(12, 0, true);

    view.setUint32(16, events.length, true);
    view.setUint16(20, targets.length, true);

    view.setUint16(22, 0, true); // Dummy protocolCode
    view.setUint32(24, dictBytes, true);
    view.setUint32(28, eventsByteSize, true);
    view.setUint32(32, totalBytes, true);

    let offset = 40;

    // 2. DICTIONARIES
    view.setUint16(offset, targets.length, true);
    offset += 2;
    for (const t of targets) {
      view.setUint32(offset, t.ecuAddress, true);
      view.setUint8(offset + 4, t.service);
      view.setUint16(offset + 5, t.pid, true);
      offset += 7;
    }

    view.setUint16(offset, signals.length, true);
    offset += 2;
    for (let i = 0; i < signals.length; i++) {
      const s = signals[i];
      const sigBuf = signalStrings[i * 2];
      const unitBuf = signalStrings[i * 2 + 1];

      view.setUint8(offset++, i);
      view.setUint8(offset++, s.targetIndex);
      view.setUint8(offset++, 3); // Float32

      view.setUint8(offset++, sigBuf.length);
      uint8.set(sigBuf, offset);
      offset += sigBuf.length;

      view.setUint8(offset++, unitBuf.length);
      uint8.set(unitBuf, offset);
      offset += unitBuf.length;
    }

    // 3. EVENTS
    for (const e of events) {
      let targetIdx = 0;
      if (e.ecuAddress !== undefined || e.service !== undefined || e.pid !== undefined) {
        targetIdx = getTargetIndex(e.ecuAddress ?? 0, e.service ?? 0, e.pid ?? 0);
      }

      const outIdx = Math.max(0, OUTCOME_MAP.indexOf(e.outcome));

      let flags = 0;
      if (e.responseDelta !== undefined) flags |= 1;
      if (e.decodeDelta !== undefined) flags |= 2;
      if (e.readings.length > 0) flags |= 4;
      if (e.errorCode !== undefined) flags |= 8;
      if (e.connectionState === 'CONNECTED') flags |= 16;

      view.setUint8(offset++, outIdx);
      view.setUint8(offset++, flags);
      view.setUint8(offset++, targetIdx);
      view.setUint32(offset, e.requestSequence, true);
      offset += 4;
      view.setUint16(offset, e.requestDelta, true);
      offset += 2;

      if (e.outcome === 'VALUE') {
        if (flags & 1) { view.setUint16(offset, e.responseDelta!, true); offset += 2; }
        if (flags & 2) { view.setUint16(offset, e.decodeDelta!, true); offset += 2; }

        view.setUint8(offset++, e.readings.length);
        for (const r of e.readings) {
          const sigIdx = getSignalIndex(r.signalDefinitionId, targetIdx, r.unit);
          const qualIdx = Math.max(0, QUALITY_MAP.indexOf(r.quality));

          view.setUint8(offset++, sigIdx);
          view.setUint8(offset++, qualIdx);
          view.setFloat32(offset, r.normalizedValue, true);
          offset += 4;
        }
      } else if (e.outcome === 'TIMEOUT' || e.outcome === 'CONNECTION_ERROR' || e.outcome === 'CANCELLED') {
        if (flags & 8) {
          const errIdx = Math.max(0, ERROR_MAP.indexOf(e.errorCode!));
          view.setUint8(offset++, errIdx);
        }
      } else if (e.outcome === 'INVALID_RESPONSE') {
        if (flags & 1) { view.setUint16(offset, e.responseDelta!, true); offset += 2; }
        if (flags & 8) {
          const errIdx = Math.max(0, ERROR_MAP.indexOf(e.errorCode!));
          view.setUint8(offset++, errIdx);
        }
      }
    }

    // 4. CRC
    const crc = this.crc32(uint8, 8, totalBytes - 8);
    view.setUint32(36, crc, true);

    return {
      payload: uint8,
      byteSize: totalBytes,
      eventCount: events.length,
      readingCount,
      formatVersion: this.formatVersion,
      payloadBytes: totalBytes,
      dictionaryBytes: dictBytes
    };
  }

  decode(payload: string | Uint8Array, context?: CodecContext): DecodeResult {
    const errors: string[] = [];
    if (typeof payload === 'string') {
      errors.push('Expected Uint8Array');
      return { events: [], eventCount: 0, readingCount: 0, formatVersion: 'unknown', errors };
    }

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const uint8 = payload;

    if (view.getUint32(0, true) !== 0x3244424F) {
      errors.push('Invalid magic bytes');
      return { events: [], eventCount: 0, readingCount: 0, formatVersion: 'unknown', errors };
    }

    const version = view.getUint16(4, true);
    if (version !== 2) {
      errors.push('Unsupported version: ' + version);
    }

    const totalBytes = view.getUint32(32, true);
    if (totalBytes !== payload.byteLength) {
      errors.push('Payload length mismatch');
    }

    const expectedCrc = view.getUint32(36, true);

    // Zero out CRC field for calculation
    const originalCrc = new Uint8Array(4);
    originalCrc.set(new Uint8Array(payload.buffer, payload.byteOffset + 36, 4));
    view.setUint32(36, 0, true);

    const actualCrc = this.crc32(uint8, 8, totalBytes - 8);

    // Restore CRC field
    new Uint8Array(payload.buffer, payload.byteOffset + 36, 4).set(originalCrc);
    if (expectedCrc !== actualCrc) {
      errors.push('CRC mismatch');
    }

    const numEvents = view.getUint32(16, true);

    let offset = 40;

    const targets: { ecuAddress: number, service: number, pid: number }[] = [];
    const signals: { sigId: string, targetIdx: number, unit: string }[] = [];
    const events: Obd2AcquisitionEvent[] = [];
    let readingCount = 0;

    try {
      const targetCount = view.getUint16(offset, true); offset += 2;
    for (let i = 0; i < targetCount; i++) {
      targets.push({
        ecuAddress: view.getUint32(offset, true),
        service: view.getUint8(offset + 4),
        pid: view.getUint16(offset + 5, true)
      });
      offset += 7;
    }

      const signalCount = view.getUint16(offset, true); offset += 2;
    for (let i = 0; i < signalCount; i++) {
      const idx = view.getUint8(offset++);
      const targetIdx = view.getUint8(offset++);
      const type = view.getUint8(offset++); // NumericType (unused atm, implicitly float32)

      const sigLen = view.getUint8(offset++);
      const sigId = this.decodeString(uint8.subarray(offset, offset + sigLen));
      offset += sigLen;

      const unitLen = view.getUint8(offset++);
      const unit = this.decodeString(uint8.subarray(offset, offset + unitLen));
      offset += unitLen;

      signals[idx] = { sigId, targetIdx, unit };
    }


      for (let i = 0; i < numEvents; i++) {
        const outIdx = view.getUint8(offset++);
        const flags = view.getUint8(offset++);
        const targetIdx = view.getUint8(offset++);
        const requestSequence = view.getUint32(offset, true); offset += 4;
        const requestDelta = view.getUint16(offset, true); offset += 2;

        const outcome = (OUTCOME_MAP[outIdx] || 'UNKNOWN_ERROR') as Obd2Outcome;
        const target: any = targets[targetIdx] || {};

        let responseDelta: number | undefined;
        let decodeDelta: number | undefined;
        let errorCode: Obd2ErrorCode | undefined;
        let readings: Obd2DecodedReading[] = [];

        if (outcome === 'VALUE') {
          if (flags & 1) { responseDelta = view.getUint16(offset, true); offset += 2; }
          if (flags & 2) { decodeDelta = view.getUint16(offset, true); offset += 2; }

          if (flags & 4) {
            const rCount = view.getUint8(offset++);
            for (let j = 0; j < rCount; j++) {
              const sigIdx = view.getUint8(offset++);
              const qualIdx = view.getUint8(offset++);
              const val = view.getFloat32(offset, true); offset += 4;

              const sig = signals[sigIdx] || { sigId: 'UNKNOWN', unit: 'UNKNOWN' };
              const quality = QUALITY_MAP[qualIdx] || 'VALID';

              readings.push({
                signalDefinitionId: sig.sigId,
                normalizedValue: val,
                unit: sig.unit,
                quality
              });
              readingCount++;
            }
          }
        } else if (outcome === 'TIMEOUT' || outcome === 'CONNECTION_ERROR' || outcome === 'CANCELLED') {
          if (flags & 8) {
            errorCode = ERROR_MAP[view.getUint8(offset++)];
          }
        } else if (outcome === 'INVALID_RESPONSE') {
          if (flags & 1) { responseDelta = view.getUint16(offset, true); offset += 2; }
          if (flags & 8) {
            errorCode = ERROR_MAP[view.getUint8(offset++)];
          }
        }

        events.push({
          requestSequence,
          ecuAddress: target.ecuAddress,
          service: target.service,
          pid: target.pid,
          requestDelta,
          responseDelta,
          decodeDelta,
          outcome,
          errorCode,
          connectionState: (flags & 16) ? 'CONNECTED' : 'DISCONNECTED',
          readings
        });
      }
    } catch (e: any) {
      errors.push('Parse error: ' + e.message);
    }

    return {
      events,
      eventCount: events.length,
      readingCount,
      formatVersion: this.formatVersion,
      errors
    };
  }
}
