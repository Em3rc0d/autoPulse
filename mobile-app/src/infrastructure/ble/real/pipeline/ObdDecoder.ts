import { decodeStandardObdPid } from '../../../../domain/obd/StandardObdCatalogV1';
import { ObdFrame, DecodedValue } from './types';

const MODE_01_BITMAP_PIDS = new Set(['00', '20', '40', '60', '80', 'A0', 'C0']);

export class ObdDecoder {
  public static decode(frames: ObdFrame[]): DecodedValue[] {
    const results: DecodedValue[] = [];
    const validFrames = frames.filter(f => f.validity === 'VALID' && f.pid !== null);

    for (const frame of validFrames) {
      if (frame.service === '41' || frame.service === '01') {
        const decoded = this.decodeMode01(frame.pid!, frame.payloadBytes);
        if (decoded) results.push(decoded);
      }
    }

    return results;
  }

  private static decodeMode01(pid: string, bytes: number[]): DecodedValue | null {
    if (MODE_01_BITMAP_PIDS.has(pid)) {
      return this.decodeCapabilityBitmap(pid, bytes);
    }

    return decodeStandardObdPid(pid, bytes);
  }

  private static decodeCapabilityBitmap(pid: string, bytes: number[]): DecodedValue | null {
    if (bytes.length < 4) return null;

    const startPid = parseInt(pid, 16) + 1;
    const supportedPids: string[] = [];

    for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
      const byte = bytes[byteIndex];
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        if ((byte & (0x80 >> bitIndex)) !== 0) {
          const pidNumber = startPid + (byteIndex * 8) + bitIndex;
          supportedPids.push(`01${pidNumber.toString(16).padStart(2, '0').toUpperCase()}`);
        }
      }
    }

    return { type: 'BITMAP', value: supportedPids, unit: '' };
  }
}
