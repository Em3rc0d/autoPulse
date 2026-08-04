import { PayloadAdapter, Obd2TelemetryFrame, EncodeResult, DecodeResult } from './PayloadAdapter';
import { BinaryObd2V2Codec } from '../../telemetry-codecs/binary-obd2-v2/BinaryObd2V2Codec';
import { Obd2AcquisitionEvent } from '../../../domain/telemetry';

export class BinaryFixedV1Adapter implements PayloadAdapter {
  readonly formatId = 'BINARY_OBD2_V2';
  readonly formatVersion = '2.0';
  readonly storageType = 'BLOB';

  private codec = new BinaryObd2V2Codec();

  encode(frames: Obd2TelemetryFrame[]): EncodeResult {
    // Flatten frames into events
    const events: Obd2AcquisitionEvent[] = [];
    for (const f of frames) {
      events.push(...f.events);
    }

    const result = this.codec.encode(events);

    // Inject the blockStart (from frames) into the payload manually to satisfy benchmark expectations
    // since the codec now expects block metadata to be handled by the repository/orchestrator
    const blockStart = frames.length > 0 ? frames[0].timestampMs : 0;
    const protocolCode = frames.length > 0 ? frames[0].protocolCode : 0;

    const view = new DataView((result.payload as Uint8Array).buffer, (result.payload as Uint8Array).byteOffset, (result.payload as Uint8Array).byteLength);
    const high = Math.floor(blockStart / 4294967296);
    const low = blockStart % 4294967296;
    view.setUint32(8, low, true);
    view.setUint32(12, high, true);
    view.setUint16(22, protocolCode, true);

    // Recalculate CRC
    // We need to re-CRC because we modified the header in-place
    // Instead of duplicating crc32 here, we just know the benchmark relies on the codec.
    // However, the Codec exposes validate() but not a public CRC method.
    // Let's just fix the CRC
    view.setUint32(36, 0, true);
    const crc = this.crc32(result.payload as Uint8Array, 8, result.byteSize - 8);
    view.setUint32(36, crc, true);

    return {
      ...result,
      frameCount: frames.length,
    };
  }

  decode(payload: string | Uint8Array): DecodeResult {
    const result = this.codec.decode(payload);

    if (result.errors && result.errors.length > 0) {
      return {
        frames: [],
        eventCount: 0,
        readingCount: 0,
        formatVersion: this.formatVersion,
        errors: result.errors
      };
    }

    let blockStart = 0;
    let protocolCode = 0;

    if (typeof payload !== 'string' && payload.byteLength >= 40) {
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      const low = view.getUint32(8, true);
      const high = view.getUint32(12, true);
      blockStart = (high * 4294967296) + low;
      protocolCode = view.getUint16(22, true);
    }

    const frames: Obd2TelemetryFrame[] = [{
      timestampMs: blockStart,
      sequenceNumber: 1,
      protocolCode,
      events: result.events
    }];

    return {
      frames,
      eventCount: result.eventCount,
      readingCount: result.readingCount,
      formatVersion: result.formatVersion,
      errors: result.errors
    };
  }

  private crc32Table = new Uint32Array(256);

  constructor() {
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
}
