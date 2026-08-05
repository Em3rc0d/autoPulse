import { UnencodedTelemetryBlock } from '../../../domain/telemetry/models/UnencodedTelemetryBlock';
import { EncodedTelemetryBlock } from '../../../domain/telemetry/models/EncodedTelemetryBlock';
import { BinaryObd2V3BlockMapper } from './BinaryObd2V3BlockMapper';
import { BinaryObd2V3Input, BinaryObd2V3Event, BinaryObd2V3Target, BinaryObd2V3Signal } from './types';
import { ObdAcquisitionEvent } from '../../../domain/telemetry/models/ObdAcquisitionEvent';

export class BinaryObd2V3Codec {
  readonly codecId = 'BINARY_OBD2_V3';
  readonly formatId = 'BINARY_OBD2_V3';
  readonly formatVersion = 3;
  readonly codecImplementationVersion = '3.0.0';
  readonly decoderVersion = '3.0.0';

  private crc32Table: Uint32Array;

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

  private crc32(buffer: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc = this.crc32Table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  private encodeString(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  private decodeString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }

  encode(block: UnencodedTelemetryBlock): EncodedTelemetryBlock {
    const input = BinaryObd2V3BlockMapper.mapToInput(block);

    // Pass 1: Calculate Byte Sizes
    const stringsBytes = input.strings.reduce((sum, s) => sum + 1 + this.encodeString(s).length, 0);
    const targetBytes = input.targets.length * 7;
    const signalBytes = input.signals.length * 3;

    let eventsBytes = 0;
    const stringBuffers: Uint8Array[] = input.strings.map(s => this.encodeString(s));

    for (const ev of input.events) {
      let eSize = 2 + 1 + 4 + 2 + 2 + 4 + 1; // flags(2) + status(1) + reqSeq(4) + reqDelta(2) + compDelta(2) + latency(4) + targetIdx(1)

      let flags = 0;
      if (ev.readings.length > 0) {
        flags |= 0x01; // HAS_READINGS
        eSize += 1 + (ev.readings.length * 6); // count(1) + (sigIdx(1) + qualIdx(1) + val(4)) * N
      }
      if (ev.negativeResponses.length > 0) {
        flags |= 0x02; // HAS_NEGATIVE_RESPONSES
        eSize += 1 + (ev.negativeResponses.length * 3); // count(1) + (reqSrv(1) + code(1) + tgtIdx(1)) * N
      }
      if (ev.rawFragments.length > 0) {
        flags |= 0x04; // HAS_RAW_FRAGMENTS
        eSize += 1; // count(1)
        for (const rf of ev.rawFragments) {
          eSize += 2 + 2 + rf.bytes.length; // deltaMs(2) + length(2) + bytes
        }
      }
      if (ev.frames.length > 0) {
        flags |= 0x08; // HAS_FRAMES
        eSize += 1;
        for (const f of ev.frames) {
          eSize += 1 + 4 + 4 + 1 + 2 + 2 + 1 + f.payloadBytes.length;
          // tIdx(1), src(4), dst(4), srv(1), pid(2), len(2), valIdx(1), bytes
        }
      }
      // Assuming completionReasonIndex is always needed
      eSize += 1;

      eventsBytes += eSize;
    }

    const dictBytes = 2 + targetBytes + 2 + signalBytes + 2 + stringsBytes;

    // Header format: Magic(4) + FormatVersion(1) + DictSize(4) + EventsSize(4)
    const headerBytes = 13;
    const totalBytes = headerBytes + dictBytes + eventsBytes;

    if (totalBytes > 262144) {
      throw new Error('BLOCK_LIMIT_EXCEEDED: maxEncodedBlockBytes');
    }

    const payload = new Uint8Array(totalBytes);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // Write Header
    view.setUint32(0, input.magic, true); // OBD3 (0x3344424F)
    view.setUint8(4, input.formatVersion);
    view.setUint32(5, dictBytes, true);
    view.setUint32(9, eventsBytes, true);

    let offset = 13;

    // Write Dictionaries
    // Targets
    view.setUint16(offset, input.targets.length, true); offset += 2;
    for (const t of input.targets) {
      view.setUint32(offset, t.sourceAddress, true); offset += 4;
      view.setUint8(offset++, t.service);
      view.setUint16(offset, t.parameterIdentifier, true); offset += 2;
    }

    // Signals
    view.setUint16(offset, input.signals.length, true); offset += 2;
    for (const s of input.signals) {
      view.setUint8(offset++, s.targetIndex);
      view.setUint8(offset++, s.signalIdIndex);
      view.setUint8(offset++, s.unitIndex);
    }

    // Strings
    view.setUint16(offset, stringBuffers.length, true); offset += 2;
    for (const sb of stringBuffers) {
      view.setUint8(offset++, sb.length); // Max 255 chars per string in dictionary
      payload.set(sb, offset);
      offset += sb.length;
    }

    // Write Events
    for (const ev of input.events) {
      let flags = 0;
      if (ev.readings.length > 0) flags |= 0x01;
      if (ev.negativeResponses.length > 0) flags |= 0x02;
      if (ev.rawFragments.length > 0) flags |= 0x04;
      if (ev.frames.length > 0) flags |= 0x08;

      view.setUint16(offset, flags, true); offset += 2;
      view.setUint8(offset++, ev.statusIndex);
      view.setUint8(offset++, ev.completionReasonIndex);
      view.setUint32(offset, ev.requestSequence, true); offset += 4;
      view.setUint16(offset, ev.requestedDeltaMs, true); offset += 2;
      view.setUint16(offset, ev.completedDeltaMs, true); offset += 2;
      view.setUint32(offset, ev.latencyMs, true); offset += 4;
      view.setUint8(offset++, ev.targetIndex);

      if (flags & 0x01) {
        view.setUint8(offset++, ev.readings.length);
        for (const r of ev.readings) {
          view.setUint8(offset++, r.signalIndex);
          view.setUint8(offset++, r.qualityIndex);
          view.setFloat32(offset, r.value, true); offset += 4;
        }
      }

      if (flags & 0x02) {
        view.setUint8(offset++, ev.negativeResponses.length);
        for (const nr of ev.negativeResponses) {
          view.setUint8(offset++, nr.requestedService);
          view.setUint8(offset++, nr.responseCode);
          view.setUint8(offset++, nr.sourceTargetIndex);
        }
      }

      if (flags & 0x04) {
        view.setUint8(offset++, ev.rawFragments.length);
        for (const rf of ev.rawFragments) {
          view.setUint16(offset, rf.receivedDeltaMs, true); offset += 2;
          view.setUint16(offset, rf.bytes.length, true); offset += 2;
          payload.set(rf.bytes, offset);
          offset += rf.bytes.length;
        }
      }

      if (flags & 0x08) {
        view.setUint8(offset++, ev.frames.length);
        for (const f of ev.frames) {
          view.setUint8(offset++, f.transportIndex);
          view.setUint32(offset, f.sourceAddress, true); offset += 4;
          view.setUint32(offset, f.destinationAddress, true); offset += 4;
          view.setUint8(offset++, f.service);
          view.setUint16(offset, f.pid, true); offset += 2;
          view.setUint16(offset, f.payloadBytes.length, true); offset += 2;
          view.setUint8(offset++, f.validityIndex);
          payload.set(f.payloadBytes, offset);
          offset += f.payloadBytes.length;
        }
      }
    }

    const payloadCrc = this.crc32(payload);

    return {
      sessionId: block.sessionId,
      blockSequence: block.blockSequence,
      windowIndex: block.windowIndex,
      startedAt: block.startedAt,
      endedAt: block.endedAt,
      isPartial: block.isPartial,
      formatId: this.formatId,
      formatVersion: this.formatVersion,
      codecImplementationVersion: this.codecImplementationVersion,
      decoderVersion: this.decoderVersion,
      storageType: 'BLOB',
      payload,
      payloadByteLength: payload.length,
      crcAlgorithm: 'CRC32',
      payloadCrc,
      eventCount: block.eventCount,
      readingCount: block.readingCount,
      firstEventSequence: block.firstEventSequence,
      lastEventSequence: block.lastEventSequence
    };
  }

  // Used to decode, passing back context because some metadata like sessionId is stored in the DB row, not payload
  decode(payload: Uint8Array, contextBlock: Partial<EncodedTelemetryBlock> = {}): UnencodedTelemetryBlock {
    if (payload.byteLength < 13) {
      throw new Error('CORRUPTED: Payload too small');
    }

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== 0x3344424F) throw new Error('UNSUPPORTED_FORMAT: Magic mismatch');

    const formatVersion = view.getUint8(4);
    if (formatVersion !== 3) throw new Error('UNSUPPORTED_FORMAT: version mismatch');

    const dictBytes = view.getUint32(5, true);
    const eventsBytes = view.getUint32(9, true);

    if (13 + dictBytes + eventsBytes > payload.byteLength) {
      throw new Error('TRUNCATED: Lengths exceed payload bounds');
    }

    // In V3, CRC is validated via external mechanism (repository checks payloadCrc),
    // but we can compute it if passed in context.
    if (contextBlock.payloadCrc !== undefined) {
      const actualCrc = this.crc32(payload);
      if (actualCrc !== contextBlock.payloadCrc) throw new Error('CORRUPTED: CRC mismatch');
    }

    let offset = 13;

    // Read Dictionaries
    const targets: BinaryObd2V3Target[] = [];
    const targetCount = view.getUint16(offset, true); offset += 2;
    for (let i = 0; i < targetCount; i++) {
      targets.push({
        sourceAddress: view.getUint32(offset, true),
        service: view.getUint8(offset + 4),
        parameterIdentifier: view.getUint16(offset + 5, true)
      });
      offset += 7;
    }

    const signals: BinaryObd2V3Signal[] = [];
    const signalCount = view.getUint16(offset, true); offset += 2;
    for (let i = 0; i < signalCount; i++) {
      signals.push({
        targetIndex: view.getUint8(offset++),
        signalIdIndex: view.getUint8(offset++),
        unitIndex: view.getUint8(offset++)
      });
    }

    const strings: string[] = [];
    const stringCount = view.getUint16(offset, true); offset += 2;
    for (let i = 0; i < stringCount; i++) {
      const len = view.getUint8(offset++);
      strings.push(this.decodeString(payload.subarray(offset, offset + len)));
      offset += len;
    }

    // Maps
    const STATUS_UNMAP = ['SUCCESS', 'SUCCESS_RAW', 'NO_DATA', 'ERROR', 'INVALID_RESPONSE', 'PARTIAL', 'TIMEOUT', 'CANCELLED', 'WRITE_FAILED', 'DISCONNECTED', 'NEGATIVE_RESPONSE'];
    const REASON_UNMAP = ['PROMPT_RECEIVED', 'TIMEOUT', 'DISCONNECTED', 'CANCELLED', 'MAX_BYTES_REACHED', 'WRITE_FAILED'];
    const QUALITY_UNMAP = ['VALID', 'DEGRADED', 'STALE', 'UNAVAILABLE', 'INVALID'];

    const events: ObdAcquisitionEvent[] = [];
    let readingCount = 0;

    const endOffset = 13 + dictBytes + eventsBytes;
    while (offset < endOffset) {
      const flags = view.getUint16(offset, true); offset += 2;
      const statusIdx = view.getUint8(offset++);
      const reasonIdx = view.getUint8(offset++);
      const reqSeq = view.getUint32(offset, true); offset += 4;
      const reqDelta = view.getUint16(offset, true); offset += 2;
      const compDelta = view.getUint16(offset, true); offset += 2;
      const latencyMs = view.getUint32(offset, true); offset += 4;
      const targetIdx = view.getUint8(offset++);

      const target = targets[targetIdx];
      const commandFamily = target?.service === 1 ? 'OBD_MODE_01' : 'OBD';
      const command = target ? `${target.service.toString(16).padStart(2, '0').toUpperCase()}${target.parameterIdentifier.toString(16).padStart(2, '0').toUpperCase()}` : 'UNKNOWN';

      const ev: ObdAcquisitionEvent = {
        sessionId: contextBlock.sessionId || 'unknown',
        sequenceNumber: reqSeq,
        requestId: `req_${reqSeq}`, // Reconstructed approx
        requestedAt: (contextBlock.startedAt || 0) + reqDelta,
        completedAt: (contextBlock.startedAt || 0) + compDelta,
        command,
        commandFamily,
        completionReason: REASON_UNMAP[reasonIdx] || 'UNKNOWN',
        latencyMs,
        rawFragments: [],
        rawText: '', // derived below
        frames: [],
        decodedReadings: [],
        negativeResponses: [],
        status: (STATUS_UNMAP[statusIdx] || 'ERROR') as any,
        warnings: []
      };

      if (flags & 0x01) { // HAS_READINGS
        const rCount = view.getUint8(offset++);
        for (let j = 0; j < rCount; j++) {
          const sigIdx = view.getUint8(offset++);
          const qualIdx = view.getUint8(offset++);
          const val = view.getFloat32(offset, true); offset += 4;

          const s = signals[sigIdx];
          const st = targets[s?.targetIndex];

          ev.decodedReadings.push({
            signalId: strings[s?.signalIdIndex] || 'UNKNOWN',
            service: st?.service.toString(16).padStart(2, '0').toUpperCase() || 'UNKNOWN',
            pid: st?.parameterIdentifier.toString(16).padStart(2, '0').toUpperCase() || null,
            value: val,
            unit: strings[s?.unitIndex] || '',
            rawBytes: [], // We don't store raw bytes per reading in V3 binary due to size, relying on rawFragments
            origin: 'OBD2',
            quality: (QUALITY_UNMAP[qualIdx] || 'INVALID') as any,
            sourceEcu: st ? st.sourceAddress.toString(16).toUpperCase() : null,
            observedAt: ev.completedAt
          });
          readingCount++;
        }
      }

      if (flags & 0x02) { // HAS_NEGATIVE_RESPONSES
        const nrCount = view.getUint8(offset++);
        for (let j = 0; j < nrCount; j++) {
          const reqSrv = view.getUint8(offset++);
          const code = view.getUint8(offset++);
          const sTgtIdx = view.getUint8(offset++); // currently ignored/dummy
          ev.negativeResponses.push({
            requestedService: reqSrv.toString(16).padStart(2, '0').toUpperCase(),
            responseCode: code.toString(16).padStart(2, '0').toUpperCase()
          });
        }
      }

      let textAcc = '';
      if (flags & 0x04) { // HAS_RAW_FRAGMENTS
        const rfCount = view.getUint8(offset++);
        for (let j = 0; j < rfCount; j++) {
          const deltaMs = view.getUint16(offset, true); offset += 2;
          const len = view.getUint16(offset, true); offset += 2;
          const bytes = payload.subarray(offset, offset + len);
          const txt = this.decodeString(bytes);
          textAcc += txt;
          ev.rawFragments.push({
            receivedAt: ev.requestedAt + deltaMs,
            decodedText: txt
          });
          offset += len;
        }
      }
      ev.rawText = textAcc;

      if (flags & 0x08) { // HAS_FRAMES
        const fCount = view.getUint8(offset++);
        for (let j = 0; j < fCount; j++) {
          const tIdx = view.getUint8(offset++);
          const sAddr = view.getUint32(offset, true); offset += 4;
          const dAddr = view.getUint32(offset, true); offset += 4;
          const srv = view.getUint8(offset++);
          const pid = view.getUint16(offset, true); offset += 2;
          const len = view.getUint16(offset, true); offset += 2;
          const valIdx = view.getUint8(offset++);
          const pBytes = payload.subarray(offset, offset + len);
          offset += len;

          ev.frames.push({
            service: srv.toString(16).padStart(2, '0').toUpperCase(),
            pid: pid.toString(16).padStart(2, '0').toUpperCase(),
            payloadBytes: Array.from(pBytes)
          });
        }
      }

      events.push(ev);
    }

    return {
      sessionId: contextBlock.sessionId || 'unknown',
      blockSequence: contextBlock.blockSequence || 0,
      windowIndex: contextBlock.windowIndex || 0,
      startedAt: contextBlock.startedAt || 0,
      endedAt: contextBlock.endedAt || 0,
      isPartial: contextBlock.isPartial || false,
      events,
      eventCount: events.length,
      readingCount,
      firstEventSequence: events.length > 0 ? events[0].sequenceNumber : 0,
      lastEventSequence: events.length > 0 ? events[events.length - 1].sequenceNumber : 0
    };
  }
}
